import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { MailService } from '../mail/mail.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AppConfig } from '../../config/app-config.service';
import { randomToken, sha256 } from '../../common/utils/crypto';
import type { TenantContext } from '../../common/types';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly subscriptions: SubscriptionsService,
    private readonly config: AppConfig,
  ) {}

  // ---------------------------------------------------------------- employees

  async list(tenantId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true, phone: true, lastLoginAt: true, emailVerifiedAt: true } }, role: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      status: m.status,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      user: m.user,
      role: { id: m.role.id, name: m.role.name, systemKey: m.role.systemKey },
    }));
  }

  /** Actors may only grant roles whose permissions they hold themselves (no privilege escalation). */
  private async assertCanGrant(ctx: TenantContext, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId: ctx.tenantId }, include: { permissions: true } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.systemKey === 'OWNER' && ctx.roleKey !== 'OWNER') throw new ForbiddenException('Only an owner can assign the Owner role');
    const escalates = role.permissions.some((p) => !ctx.permissions.has(p.permissionKey));
    if (escalates) throw new ForbiddenException('You cannot grant permissions you do not have');
    return role;
  }

  async invite(ctx: TenantContext, input: { name: string; email: string; roleId: string }, inviterName: string) {
    const role = await this.assertCanGrant(ctx, input.roleId);
    let user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (user) {
      const existing = await this.prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: ctx.tenantId } } });
      if (existing) throw new ConflictException('This person is already a member of your business');
    }
    await this.subscriptions.assertWithinLimit(ctx.tenantId, 'employees');

    let setPasswordLink: string | undefined;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    await this.prisma.$transaction(async (tx) => {
      if (!user) {
        // Account without a usable password; the invitee sets one via a reset link.
        user = await tx.user.create({
          data: { email: input.email, name: input.name, passwordHash: await argon2.hash(randomToken(32)) },
        });
        const token = randomToken(32);
        await tx.passwordResetToken.create({
          data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000) },
        });
        setPasswordLink = `${this.config.get('APP_URL')}/reset-password?token=${token}&invite=1`;
      }
      await tx.membership.create({
        data: { tenantId: ctx.tenantId, userId: user.id, roleId: role.id, status: 'ACTIVE', invitedBy: ctx.userId, joinedAt: new Date() },
      });
    });

    await this.mail.enqueue({
      template: 'invite',
      to: input.email,
      tenantId: ctx.tenantId,
      dedupeKey: `invite:${ctx.tenantId}:${user!.id}`,
      data: { businessName: tenant.name, inviterName, roleName: role.name, link: setPasswordLink },
    });
    await this.audit.log({ action: 'employee.invited', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'User', entityId: user!.id, metadata: { role: role.name } });
    return { ok: true };
  }

  private async ownersCount(tenantId: string) {
    return this.prisma.membership.count({ where: { tenantId, status: 'ACTIVE', role: { systemKey: 'OWNER' } } });
  }

  async update(ctx: TenantContext, membershipId: string, input: { roleId?: string; status?: 'ACTIVE' | 'DISABLED' }) {
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, tenantId: ctx.tenantId }, include: { role: true } });
    if (!m) throw new NotFoundException('Employee not found');
    if (m.userId === ctx.userId) throw new BadRequestException('You cannot change your own role or status');
    if (m.role.systemKey === 'OWNER' && ctx.roleKey !== 'OWNER') throw new ForbiddenException('Only an owner can change another owner');
    if (input.roleId) await this.assertCanGrant(ctx, input.roleId);

    const losingOwner = m.role.systemKey === 'OWNER' && ((input.roleId && input.roleId !== m.roleId) || input.status === 'DISABLED');
    if (losingOwner && (await this.ownersCount(ctx.tenantId)) <= 1) {
      throw new BadRequestException('A business must keep at least one active owner');
    }
    const updated = await this.prisma.membership.update({
      where: { id: m.id },
      data: { roleId: input.roleId ?? undefined, status: input.status ?? undefined },
    });
    if (input.status === 'DISABLED') {
      // Force re-authentication so a disabled member loses access immediately.
      await this.prisma.refreshToken.updateMany({ where: { userId: m.userId, tenantId: ctx.tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ action: 'employee.updated', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Membership', entityId: m.id, metadata: input });
    return updated;
  }

  async remove(ctx: TenantContext, membershipId: string) {
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, tenantId: ctx.tenantId }, include: { role: true } });
    if (!m) throw new NotFoundException('Employee not found');
    if (m.userId === ctx.userId) throw new BadRequestException('You cannot remove yourself');
    if (m.role.systemKey === 'OWNER') throw new BadRequestException('Owners cannot be removed. Change their role first.');
    await this.prisma.membership.delete({ where: { id: m.id } });
    await this.prisma.refreshToken.updateMany({ where: { userId: m.userId, tenantId: ctx.tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ action: 'employee.removed', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Membership', entityId: m.id });
    return { ok: true };
  }

  // ---------------------------------------------------------------- roles

  async roles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: { permissions: { select: { permissionKey: true } }, _count: { select: { memberships: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      systemKey: r.systemKey,
      permissions: r.permissions.map((p) => p.permissionKey),
      members: r._count.memberships,
    }));
  }

  async createRole(ctx: TenantContext, input: { name: string; description?: string; permissions: string[] }) {
    if (input.permissions.some((p) => !ctx.permissions.has(p))) throw new ForbiddenException('You cannot grant permissions you do not have');
    const role = await this.prisma.role.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        description: input.description,
        permissions: { create: input.permissions.map((permissionKey) => ({ permissionKey })) },
      },
    });
    await this.audit.log({ action: 'role.created', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Role', entityId: role.id });
    return role;
  }

  async updateRole(ctx: TenantContext, id: string, input: { name: string; description?: string; permissions: string[] }) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.systemKey === 'OWNER') throw new BadRequestException('The Owner role always has every permission');
    if (input.permissions.some((p) => !ctx.permissions.has(p))) throw new ForbiddenException('You cannot grant permissions you do not have');
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.role.update({
        where: { id: role.id },
        data: {
          name: role.systemKey ? role.name : input.name,
          description: input.description,
          permissions: { create: input.permissions.map((permissionKey) => ({ permissionKey })) },
        },
      }),
    ]);
    await this.audit.log({ action: 'role.updated', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Role', entityId: role.id, metadata: { permissions: input.permissions } });
    return { ok: true };
  }

  async deleteRole(ctx: TenantContext, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { _count: { select: { memberships: true } } } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.systemKey) throw new BadRequestException('Built-in roles cannot be deleted');
    if (role._count.memberships) throw new BadRequestException('Move members to another role before deleting this one');
    await this.prisma.role.delete({ where: { id: role.id } });
    await this.audit.log({ action: 'role.deleted', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Role', entityId: role.id });
    return { ok: true };
  }
}
