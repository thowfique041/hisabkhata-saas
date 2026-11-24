import { Controller, Get, HttpCode, Post, Put, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { contactSchema, listQuerySchema, PERMISSIONS, updateProfileSchema } from '@hisabkhata/shared';
import { ClientMeta, CurrentUser, Public, RequirePermissions, Tenant, ZBody, ZQuery, type ClientMetaInfo } from '../../common/decorators';
import type { AuthUser, TenantContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { pageArgs, paginated } from '../../common/utils/pagination';

@ApiTags('Account & platform')
@Controller()
export class MiscController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
  ) {}

  /** Liveness + readiness for Render health checks. */
  @Public()
  @Get('health')
  async health() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    const redis = this.jobs.enabled ? ((await this.jobs.ping()) ? 'up' : 'down') : 'disabled';
    return { status: 'ok', database: 'up', redis, latencyMs: Date.now() - started, time: new Date().toISOString() };
  }

  @Get('profile')
  profile(@CurrentUser() u: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: u.id },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, emailVerifiedAt: true, createdAt: true, lastLoginAt: true },
    });
  }

  @Put('profile')
  async updateProfile(@CurrentUser() u: AuthUser, @ZBody(updateProfileSchema) body: any) {
    return this.prisma.user.update({
      where: { id: u.id },
      data: { name: body.name, phone: body.phone ?? null },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });
  }

  @Get('announcements')
  announcements() {
    return this.prisma.announcement.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 5 });
  }

  @Get('audit-logs')
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  async auditLogs(@Tenant() t: TenantContext, @ZQuery(listQuerySchema) q: any) {
    const where = { tenantId: t.tenantId, ...(q.search ? { action: { contains: q.search } } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(rows, total, q);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('public/contact')
  async contact(@ZBody(contactSchema) body: any, @ClientMeta() meta: ClientMetaInfo) {
    await this.audit.log({ action: 'public.contact_message', metadata: body, ...meta });
    return { ok: true };
  }
}
