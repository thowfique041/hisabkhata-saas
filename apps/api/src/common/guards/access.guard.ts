import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRE_TENANT, REQUIRED_PERMISSIONS, SUPER_ADMIN_ONLY } from '../decorators';
import type { AppRequest } from '../types';

/**
 * Resolves the active tenant from the verified access token, then re-checks against the
 * database that the membership, role, user and tenant are all active. The tenant id is
 * never taken from the request body, query or headers.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const superOnly = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY, targets);
    const needsTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT, targets);
    const permissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, targets) ?? [];
    if (!superOnly && !needsTenant) return true;

    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const auth = req.user;
    if (!auth) throw new ForbiddenException();

    if (superOnly) {
      const user = await this.prisma.user.findUnique({
        where: { id: auth.id },
        select: { isSuperAdmin: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE' || !user.isSuperAdmin) {
        throw new ForbiddenException('Platform administrator access required');
      }
      return true;
    }

    if (!auth.tid) throw new ForbiddenException({ message: 'No active business selected', code: 'NO_TENANT' });

    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: auth.id, tenantId: auth.tid } },
      include: {
        user: { select: { status: true } },
        tenant: true,
        role: { include: { permissions: { select: { permissionKey: true } } } },
      },
    });
    if (!membership || membership.status !== 'ACTIVE' || membership.user.status !== 'ACTIVE') {
      throw new ForbiddenException({ message: 'You are not a member of this business', code: 'NOT_MEMBER' });
    }
    if (membership.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException({ message: 'This business account is suspended', code: 'TENANT_SUSPENDED' });
    }

    const granted = new Set(membership.role.permissions.map((p) => p.permissionKey));
    const missing = permissions.filter((p) => !granted.has(p));
    if (missing.length) {
      throw new ForbiddenException({ message: 'You do not have permission to do this', code: 'FORBIDDEN', missing });
    }

    const t = membership.tenant;
    req.tenantCtx = {
      tenantId: t.id,
      userId: auth.id,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleKey: membership.role.systemKey,
      permissions: granted,
      tenant: {
        id: t.id,
        name: t.name,
        currency: t.currency,
        timezone: t.timezone,
        allowNegativeStock: t.allowNegativeStock,
        defaultTaxRate: t.defaultTaxRate.toString(),
        invoicePrefix: t.invoicePrefix,
      },
    };
    return true;
  }
}
