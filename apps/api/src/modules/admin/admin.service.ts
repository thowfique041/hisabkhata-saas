import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { NotificationsService } from '../core/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { pageArgs, paginated } from '../../common/utils/pagination';
import { dec, money } from '../../common/utils/decimal';
import type { Prisma } from '../../generated/prisma/client';

const s2 = (v: unknown) => money(dec(v as any)).toFixed(2);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview() {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [tenants, active, suspended, users, newTenants, plans, revenue, revenue30, pendingPayments, monthly] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count(),
      this.prisma.tenant.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.$queryRaw<any[]>`
        SELECT p."code", p."name", s."status", COUNT(*)::int AS count
          FROM "Subscription" s JOIN "SubscriptionPlan" p ON p."id" = s."planId"
         WHERE s."status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE')
         GROUP BY 1, 2, 3 ORDER BY 1`,
      this.prisma.billingPayment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true } }),
      this.prisma.billingPayment.aggregate({ where: { status: 'SUCCEEDED', verifiedAt: { gte: since30 } }, _sum: { amount: true } }),
      this.prisma.billingPayment.count({ where: { status: 'PENDING' } }),
      this.prisma.$queryRaw<any[]>`
        SELECT to_char(m, 'YYYY-MM') AS month,
               COALESCE((SELECT SUM("amount") FROM "BillingPayment" b WHERE b."status" = 'SUCCEEDED' AND date_trunc('month', b."verifiedAt") = m), 0) AS revenue,
               (SELECT COUNT(*)::int FROM "Tenant" t WHERE date_trunc('month', t."createdAt") = m) AS signups
          FROM generate_series(date_trunc('month', NOW()) - INTERVAL '11 months', date_trunc('month', NOW()), INTERVAL '1 month') m
         ORDER BY m`,
    ]);
    return {
      tenants: { total: tenants, active, suspended, newLast30Days: newTenants },
      users,
      subscriptions: plans,
      revenue: { total: s2(revenue._sum.amount), last30Days: s2(revenue30._sum.amount), pendingPayments },
      monthly: monthly.map((m) => ({ month: m.month, revenue: s2(m.revenue), signups: m.signups })),
    };
  }

  async analytics() {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [activeTenants, salesVolume, byType, topTenants] = await Promise.all([
      this.prisma.$queryRaw<any[]>`SELECT COUNT(DISTINCT "tenantId")::int AS count FROM "Sale" WHERE "createdAt" >= ${since30}`,
      this.prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS orders FROM "Sale" WHERE "createdAt" >= ${since30} AND "status" <> 'CANCELLED'`,
      this.prisma.tenant.groupBy({ by: ['businessType'], _count: { _all: true } }),
      // Usage only (counts), never business amounts: tenant financials are private.
      this.prisma.$queryRaw<any[]>`
        SELECT t."id", t."name", COUNT(s."id")::int AS orders
          FROM "Tenant" t LEFT JOIN "Sale" s ON s."tenantId" = t."id" AND s."createdAt" >= ${since30}
         GROUP BY t."id" ORDER BY orders DESC LIMIT 10`,
    ]);
    return {
      activeTenantsLast30Days: activeTenants[0]?.count ?? 0,
      ordersLast30Days: salesVolume[0]?.orders ?? 0,
      tenantsByType: byType.map((b) => ({ type: b.businessType, count: b._count._all })),
      mostActiveTenants: topTenants,
    };
  }

  async tenants(q: { page: number; pageSize: number; search?: string; status?: string }) {
    const where: Prisma.TenantWhereInput = {
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { slug: { contains: q.search } }, { email: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          _count: { select: { memberships: true, products: true, sales: true } },
          subscriptions: { where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] } }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return paginated(
      rows.map(({ subscriptions, _count, ...t }) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        businessType: t.businessType,
        email: t.email,
        status: t.status,
        createdAt: t.createdAt,
        members: _count.memberships,
        products: _count.products,
        sales: _count.sales,
        plan: subscriptions[0] ? { code: subscriptions[0].plan.code, name: subscriptions[0].plan.name, status: subscriptions[0].status, endsAt: subscriptions[0].endsAt } : null,
      })),
      total,
      q,
    );
  }

  async tenant(id: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        memberships: { include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true } }, role: { select: { name: true } } } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        billingPayments: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { products: true, customers: true, sales: true, purchases: true } },
      },
    });
    if (!t) throw new NotFoundException('Tenant not found');
    return t;
  }

  async setTenantStatus(adminId: string, id: string, status: 'ACTIVE' | 'SUSPENDED', reason?: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tenant not found');
    await this.prisma.tenant.update({ where: { id }, data: { status, suspendedReason: status === 'SUSPENDED' ? reason ?? null : null } });
    if (status === 'SUSPENDED') {
      await this.prisma.refreshToken.updateMany({ where: { tenantId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ action: status === 'SUSPENDED' ? 'admin.tenant_suspended' : 'admin.tenant_activated', userId: adminId, tenantId: id, metadata: { reason } });
    return { ok: true };
  }

  async users(q: { page: number; pageSize: number; search?: string }) {
    const where: Prisma.UserWhereInput = q.search
      ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          isSuperAdmin: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          memberships: { select: { tenant: { select: { id: true, name: true } }, role: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(rows, total, q);
  }

  async setUserStatus(adminId: string, id: string, status: 'ACTIVE' | 'DISABLED') {
    if (id === adminId) throw new BadRequestException('You cannot change your own status');
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id }, data: { status } });
    if (status === 'DISABLED') await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ action: 'admin.user_status', userId: adminId, entity: 'User', entityId: id, metadata: { status } });
    return { ok: true };
  }

  plans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { subscriptions: true } } } });
  }

  async createPlan(adminId: string, input: any) {
    const plan = await this.prisma.subscriptionPlan.create({ data: input });
    await this.audit.log({ action: 'admin.plan_created', userId: adminId, entity: 'SubscriptionPlan', entityId: plan.id });
    return plan;
  }

  async updatePlan(adminId: string, id: string, input: any) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    if (existing.code === 'FREE' && (input.code !== 'FREE' || !input.isActive)) {
      throw new BadRequestException('The FREE plan is the fallback for expired subscriptions and must stay active');
    }
    const plan = await this.prisma.subscriptionPlan.update({ where: { id }, data: input });
    await this.audit.log({ action: 'admin.plan_updated', userId: adminId, entity: 'SubscriptionPlan', entityId: id, metadata: input });
    return plan;
  }

  async subscriptionList(q: { page: number; pageSize: number; status?: string }) {
    const where: Prisma.SubscriptionWhereInput = q.status ? { status: q.status as any } : {};
    const [rows, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: { plan: { select: { code: true, name: true } }, tenant: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return paginated(rows, total, q);
  }

  async billingPayments(q: { page: number; pageSize: number; status?: string }) {
    const where: Prisma.BillingPaymentWhereInput = q.status ? { status: q.status as any } : {};
    const [rows, total] = await Promise.all([
      this.prisma.billingPayment.findMany({
        where,
        include: { tenant: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
        omit: { rawPayload: true },
      }),
      this.prisma.billingPayment.count({ where }),
    ]);
    return paginated(rows, total, q);
  }

  async confirmManualPayment(adminId: string, id: string, reference?: string) {
    const p = await this.prisma.billingPayment.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Payment not found');
    if (p.provider !== 'manual') throw new BadRequestException('Only manual payments can be confirmed by an administrator');
    const res = await this.subscriptions.confirmPayment(id, { confirmedBy: adminId, reference: reference ?? null }, `admin:${adminId}`);
    await this.notifications.notifyTenant(p.tenantId, { type: 'subscription', title: 'Payment confirmed', body: `Your ${p.planCode} plan is now active.`, link: '/subscription' });
    return res;
  }

  auditLogs(q: { page: number; pageSize: number; search?: string; tenantId?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.tenantId ? { tenantId: q.tenantId } : {}),
      ...(q.search ? { OR: [{ action: { contains: q.search } }, { entity: { contains: q.search } }] } : {}),
    };
    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } }, tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.auditLog.count({ where }),
    ]).then(([rows, total]) => paginated(rows, total, q));
  }

  emailLogs(q: { page: number; pageSize: number; status?: string }) {
    const where: Prisma.EmailLogWhereInput = q.status ? { status: q.status as any } : {};
    return Promise.all([
      this.prisma.emailLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.emailLog.count({ where }),
    ]).then(([rows, total]) => paginated(rows, total, q));
  }

  announcements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createAnnouncement(adminId: string, input: any) {
    return this.prisma.announcement.create({ data: { ...input, createdById: adminId } });
  }

  async updateAnnouncement(id: string, input: any) {
    if (!(await this.prisma.announcement.findUnique({ where: { id } }))) throw new NotFoundException();
    return this.prisma.announcement.update({ where: { id }, data: input });
  }

  async deleteAnnouncement(id: string) {
    await this.prisma.announcement.deleteMany({ where: { id } });
    return { ok: true };
  }
}
