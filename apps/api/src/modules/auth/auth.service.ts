import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { LoginInput, RegisterInput, SessionPayload, Permission } from '@hisabkhata/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/app-config.service';
import { AuditService } from '../core/audit.service';
import { MailService } from '../mail/mail.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TenantProvisioningService } from '../tenants/tenant-provisioning.service';
import { TokenService } from './token.service';
import { randomToken, sha256 } from '../../common/utils/crypto';
import type { ClientMetaInfo } from '../../common/decorators';

const ARGON_OPTS = { type: argon2.argon2id as 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Pre-computed hash used to keep login timing similar for unknown emails.
let dummyHash: string | undefined;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly provisioning: TenantProvisioningService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  hashPassword(pw: string) {
    return argon2.hash(pw, ARGON_OPTS);
  }

  async register(input: RegisterInput, meta: ClientMetaInfo) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('An account with this email already exists');

    const passwordHash = await this.hashPassword(input.password);
    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash, phone: input.phone },
      });
      const { tenant } = await this.provisioning.provision(tx, {
        name: input.businessName,
        businessType: input.businessType,
        ownerUserId: user.id,
        email: input.email,
        phone: input.phone,
      });
      return { user, tenant };
    });

    await this.audit.log({ action: 'auth.register', userId: user.id, tenantId: tenant.id, ...meta });
    await this.sendVerification(user.id, user.email);
    await this.mail.enqueue({
      template: 'welcome',
      to: user.email,
      tenantId: tenant.id,
      dedupeKey: `welcome:${user.id}`,
      data: { name: user.name, businessName: tenant.name },
    });
    return this.tokens.issue(user, tenant.id, meta);
  }

  async validateCredentials(input: LoginInput, meta: ClientMetaInfo) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      dummyHash ??= await this.hashPassword('not-a-real-password-1');
      await argon2.verify(dummyHash, input.password).catch(() => false);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Too many failed attempts. Try again in a few minutes.');
    }
    const ok = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await this.audit.log({ action: 'auth.login_failed', userId: user.id, ...meta });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') throw new ForbiddenException('This account has been disabled');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.log({ action: 'auth.login', userId: user.id, ...meta });
    return user;
  }

  async login(input: LoginInput, meta: ClientMetaInfo) {
    const user = await this.validateCredentials(input, meta);
    const tenantId = await this.defaultTenantFor(user.id);
    return this.tokens.issue(user, tenantId, meta);
  }

  private async defaultTenantFor(userId: string, preferred?: string | null): Promise<string | null> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true },
    });
    if (preferred && memberships.some((m) => m.tenantId === preferred)) return preferred;
    return memberships[0]?.tenantId ?? null;
  }

  async refresh(raw: string | undefined, meta: ClientMetaInfo) {
    if (!raw) throw new UnauthorizedException('Session expired');
    const old = await this.tokens.consume(raw);
    const user = await this.prisma.user.findUnique({ where: { id: old.userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Session expired');
    const tenantId = await this.defaultTenantFor(user.id, old.tenantId);
    const issued = await this.tokens.issue(user, tenantId, meta, old.familyId);
    await this.tokens.linkReplacement(old.id, issued.tokenId);
    return issued;
  }

  async switchTenant(auth: { id: string }, tenantId: string, rawRefresh: string | undefined, meta: ClientMetaInfo) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: auth.id, tenantId } },
      include: { tenant: true, user: true },
    });
    if (!membership || membership.status !== 'ACTIVE') throw new ForbiddenException('You are not a member of this business');
    if (membership.tenant.status !== 'ACTIVE') throw new ForbiddenException('This business account is suspended');
    await this.tokens.revokeByRaw(rawRefresh);
    await this.audit.log({ action: 'auth.switch_tenant', userId: auth.id, tenantId, ...meta });
    return this.tokens.issue(membership.user, tenantId, meta);
  }

  async logout(raw: string | undefined, userId?: string) {
    await this.tokens.revokeByRaw(raw);
    if (userId) await this.audit.log({ action: 'auth.logout', userId });
  }

  // ---------------------------------------------------------------- email verification

  async sendVerification(userId: string, email: string) {
    const token = randomToken(32);
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 3600_000) },
    });
    await this.mail.enqueue({
      template: 'verify-email',
      to: email,
      dedupeKey: `verify:${sha256(token).slice(0, 24)}`,
      data: { link: `${this.config.get('APP_URL')}/verify-email?token=${token}` },
    });
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };
    const recent = await this.prisma.emailVerificationToken.count({
      where: { userId, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recent) throw new BadRequestException('Please wait a minute before requesting another email');
    await this.sendVerification(user.id, user.email);
    return { ok: true };
  }

  async verifyEmail(token: string) {
    const row = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
    await this.audit.log({ action: 'auth.email_verified', userId: row.userId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- password reset

  /** Always responds the same way so the endpoint cannot be used to discover accounts. */
  async forgotPassword(email: string, meta: ClientMetaInfo) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.status === 'ACTIVE') {
      const token = randomToken(32);
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) },
      });
      await this.mail.enqueue({
        template: 'password-reset',
        to: user.email,
        dedupeKey: `reset:${sha256(token).slice(0, 24)}`,
        data: { link: `${this.config.get('APP_URL')}/reset-password?token=${token}` },
      });
      await this.audit.log({ action: 'auth.password_reset_requested', userId: user.id, ...meta });
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string, meta: ClientMetaInfo) {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }
    const passwordHash = await this.hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
      // Completing a reset also proves ownership of the mailbox.
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash, failedLogins: 0, lockedUntil: null, emailVerifiedAt: new Date() },
      }),
    ]);
    await this.tokens.revokeAllForUser(row.userId);
    await this.audit.log({ action: 'auth.password_reset', userId: row.userId, ...meta });
    return { ok: true };
  }

  async changePassword(userId: string, current: string, next: string, meta: ClientMetaInfo) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, current).catch(() => false))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(next) } });
    await this.tokens.revokeAllForUser(userId);
    await this.audit.log({ action: 'auth.password_changed', userId, ...meta });
    return { ok: true };
  }

  // ---------------------------------------------------------------- session

  async session(userId: string, tenantId: string | null): Promise<SessionPayload> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { tenant: true, role: { include: { permissions: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const active = memberships.find((m) => m.tenantId === tenantId && m.tenant.status === 'ACTIVE') ?? null;
    const current = active ? await this.subscriptions.getCurrent(active.tenantId) : null;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: !!user.emailVerifiedAt,
        isSuperAdmin: user.isSuperAdmin,
        avatarUrl: user.avatarUrl,
      },
      tenants: memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role.name,
        status: m.tenant.status,
      })),
      activeTenant: active
        ? {
            id: active.tenant.id,
            name: active.tenant.name,
            slug: active.tenant.slug,
            role: active.role.name,
            status: active.tenant.status,
            currency: active.tenant.currency,
            timezone: active.tenant.timezone,
            logoUrl: active.tenant.logoUrl,
          }
        : null,
      permissions: (active?.role.permissions.map((p) => p.permissionKey) ?? []) as Permission[],
      plan: current
        ? {
            code: current.plan.code,
            name: current.plan.name,
            status: current.subscription?.status ?? 'ACTIVE',
            endsAt: current.subscription?.endsAt?.toISOString() ?? null,
            features: current.plan.features,
          }
        : null,
    };
  }
}
