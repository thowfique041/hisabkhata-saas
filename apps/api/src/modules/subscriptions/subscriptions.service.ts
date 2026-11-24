import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { PlanFeature } from '@hisabkhata/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { NotificationsService } from '../core/notifications.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import { PaymentProviderRegistry } from './providers/provider.registry';
import type { BillingInterval, SubscriptionPlan } from '../../generated/prisma/client';
import { formatMoney } from '@hisabkhata/shared';

const LIVE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'] as const;

export type LimitKind = 'products' | 'employees';

@Injectable()
export class SubscriptionsService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly jobs: JobsService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  onModuleInit() {
    this.jobs.register('subscription.expiry-check', () => this.runExpiryCheck());
  }

  listPublicPlans() {
    return this.prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  async freePlan(): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { code: 'FREE' } });
    if (!plan) throw new Error('FREE plan is missing. Run the seed script.');
    return plan;
  }

  /** The tenant's live subscription, or a synthetic Free subscription if none. */
  async getCurrent(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: [...LIVE_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (sub) return { subscription: sub, plan: sub.plan };
    return { subscription: null, plan: await this.freePlan() };
  }

  async usage(tenantId: string) {
    const [products, employees] = await Promise.all([
      this.prisma.product.count({ where: { tenantId, archivedAt: null } }),
      this.prisma.membership.count({ where: { tenantId, status: { in: ['ACTIVE', 'INVITED'] } } }),
    ]);
    return { products, employees };
  }

  /** Throws 403 PLAN_LIMIT when adding one more item would exceed the plan's limit (-1 = unlimited). */
  async assertWithinLimit(tenantId: string, kind: LimitKind, adding = 1) {
    const { plan } = await this.getCurrent(tenantId);
    const limit = kind === 'products' ? plan.maxProducts : plan.maxEmployees;
    if (limit < 0) return;
    const usage = await this.usage(tenantId);
    if (usage[kind] + adding > limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT',
        message: `Your ${plan.name} plan allows ${limit} ${kind}. Upgrade your plan to add more.`,
        limit,
        kind,
      });
    }
  }

  async hasFeature(tenantId: string, feature: PlanFeature) {
    const { plan } = await this.getCurrent(tenantId);
    return plan.features.includes(feature);
  }

  async assertFeature(tenantId: string, feature: PlanFeature) {
    if (!(await this.hasFeature(tenantId, feature))) {
      throw new ForbiddenException({ code: 'PLAN_FEATURE', message: 'This feature is not included in your current plan.' });
    }
  }

  async overview(tenantId: string) {
    const [current, usage, history, payments, plans] = await Promise.all([
      this.getCurrent(tenantId),
      this.usage(tenantId),
      this.prisma.subscription.findMany({ where: { tenantId }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.billingPayment.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.listPublicPlans(),
    ]);
    return { ...current, usage, history, payments, plans, providers: this.providers.available() };
  }

  /**
   * Plan change. Moving to a free plan is immediate (if usage fits). Paid plans create a PENDING
   * BillingPayment; the plan only activates after the provider confirms the payment.
   */
  async changePlan(
    tenantId: string,
    userId: string,
    input: { planCode: string; interval: BillingInterval; provider: string },
    customer: { name: string; email: string },
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { code: input.planCode } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found');
    const usage = await this.usage(tenantId);
    if (plan.maxProducts >= 0 && usage.products > plan.maxProducts) {
      throw new ConflictException(`You have ${usage.products} active products. The ${plan.name} plan allows ${plan.maxProducts}. Archive some products first.`);
    }
    if (plan.maxEmployees >= 0 && usage.employees > plan.maxEmployees) {
      throw new ConflictException(`You have ${usage.employees} team members. The ${plan.name} plan allows ${plan.maxEmployees}.`);
    }

    const amount = input.interval === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
    if (amount.isZero()) {
      await this.activate(tenantId, plan, input.interval, null);
      await this.audit.log({ tenantId, userId, action: 'subscription.changed', entity: 'SubscriptionPlan', entityId: plan.id, metadata: { plan: plan.code } });
      return { status: 'ACTIVATED' as const };
    }

    const provider = this.providers.get(input.provider);
    const payment = await this.prisma.billingPayment.create({
      data: {
        tenantId,
        provider: provider.name,
        providerRef: `HK${Date.now()}${Math.floor(Math.random() * 1e6)}`,
        planCode: plan.code,
        interval: input.interval,
        amount,
        currency: plan.currency,
      },
    });
    const next = await provider.initiate({ payment, plan, customer });
    await this.audit.log({ tenantId, userId, action: 'billing.payment_initiated', entity: 'BillingPayment', entityId: payment.id, metadata: { provider: provider.name, plan: plan.code } });
    return { status: 'PENDING_PAYMENT' as const, paymentId: payment.id, ...next };
  }

  /**
   * Called ONLY after a provider confirmation has been verified (webhook signature + server-side
   * validation) or a super admin confirmed a manual payment. Idempotent.
   */
  async confirmPayment(paymentId: string, verifiedPayload: Record<string, unknown>, actor: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.billingPayment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === 'SUCCEEDED') return { payment, already: true, sub: null };
      const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { code: payment.planCode } });
      const sub = await this.activate(payment.tenantId, plan, payment.interval, tx);
      const updated = await tx.billingPayment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', verifiedAt: new Date(), subscriptionId: sub.id, rawPayload: verifiedPayload as any },
      });
      return { payment: updated, already: false, sub, plan };
    });
    if (!result.already && result.sub) {
      await this.audit.log({ tenantId: result.payment.tenantId, action: 'billing.payment_confirmed', entity: 'BillingPayment', entityId: paymentId, metadata: { actor } });
      const owner = await this.ownerOf(result.payment.tenantId);
      if (owner) {
        await this.mail.enqueue({
          template: 'payment-confirmation',
          to: owner.email,
          tenantId: result.payment.tenantId,
          dedupeKey: `payment-confirmation:${paymentId}`,
          data: {
            amount: formatMoney(result.payment.amount.toString(), result.payment.currency),
            planName: (result as any).plan?.name ?? result.payment.planCode,
            interval: result.payment.interval.toLowerCase(),
            reference: result.payment.providerRef,
            endsAt: result.sub.endsAt?.toISOString().slice(0, 10) ?? 'no end date',
          },
        });
      }
    }
    return result.payment;
  }

  async markPaymentFailed(paymentId: string, payload: Record<string, unknown>) {
    await this.prisma.billingPayment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'FAILED', rawPayload: payload as any },
    });
  }

  private async activate(tenantId: string, plan: SubscriptionPlan, interval: BillingInterval, tx: any) {
    const db = tx ?? this.prisma;
    const now = new Date();
    const current = await db.subscription.findFirst({
      where: { tenantId, status: { in: [...LIVE_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    });
    // Renewing the same paid plan extends from the current end date.
    const base =
      current && current.planId === plan.id && current.status === 'ACTIVE' && current.endsAt && current.endsAt > now ? current.endsAt : now;
    const isFree = plan.priceMonthly.isZero() && plan.priceYearly.isZero();
    const endsAt = isFree ? null : new Date(base);
    if (endsAt) {
      if (interval === 'YEARLY') endsAt.setUTCFullYear(endsAt.getUTCFullYear() + 1);
      else endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
    }
    if (current) {
      await db.subscription.update({ where: { id: current.id }, data: { status: 'CANCELLED', cancelledAt: now } });
    }
    return db.subscription.create({
      data: { tenantId, planId: plan.id, status: 'ACTIVE', interval, startsAt: now, endsAt },
    });
  }

  private async ownerOf(tenantId: string) {
    const m = await this.prisma.membership.findFirst({
      where: { tenantId, role: { systemKey: 'OWNER' }, status: 'ACTIVE' },
      include: { user: true, tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    return m ? { email: m.user.email, name: m.user.name, businessName: m.tenant.name } : null;
  }

  /** Daily job: warn 3 days before expiry, then downgrade expired subscriptions to Free. */
  async runExpiryCheck() {
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 86_400_000);
    const free = await this.freePlan();

    const expiring = await this.prisma.subscription.findMany({
      where: { status: { in: ['TRIALING', 'ACTIVE'] }, endsAt: { gt: now, lte: soon }, expiryNotifiedAt: null },
      include: { plan: true },
    });
    for (const s of expiring) {
      const owner = await this.ownerOf(s.tenantId);
      if (owner) {
        await this.mail.enqueue({
          template: 'subscription-expiring',
          to: owner.email,
          tenantId: s.tenantId,
          dedupeKey: `sub-expiring:${s.id}`,
          data: { planName: s.plan.name, businessName: owner.businessName, endsAt: s.endsAt!.toISOString().slice(0, 10), expired: false },
        });
      }
      await this.notifications.notifyTenant(s.tenantId, {
        type: 'subscription',
        title: `${s.plan.name} plan ends soon`,
        body: `Your plan ends on ${s.endsAt!.toISOString().slice(0, 10)}.`,
        link: '/subscription',
      });
      await this.prisma.subscription.update({ where: { id: s.id }, data: { expiryNotifiedAt: now } });
    }

    const expired = await this.prisma.subscription.findMany({
      where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] }, endsAt: { lte: now } },
      include: { plan: true },
    });
    for (const s of expired) {
      await this.prisma.$transaction([
        this.prisma.subscription.update({ where: { id: s.id }, data: { status: 'EXPIRED' } }),
        this.prisma.subscription.create({ data: { tenantId: s.tenantId, planId: free.id, status: 'ACTIVE', startsAt: now } }),
      ]);
      const owner = await this.ownerOf(s.tenantId);
      if (owner) {
        await this.mail.enqueue({
          template: 'subscription-expiring',
          to: owner.email,
          tenantId: s.tenantId,
          dedupeKey: `sub-expired:${s.id}`,
          data: { planName: s.plan.name, businessName: owner.businessName, endsAt: s.endsAt!.toISOString().slice(0, 10), expired: true },
        });
      }
      await this.notifications.notifyTenant(s.tenantId, {
        type: 'subscription',
        title: `${s.plan.name} plan expired`,
        body: 'Your business moved to the Free plan. Renew any time from Subscription.',
        link: '/subscription',
      });
    }
    this.logger.log(`Expiry check: ${expiring.length} reminders, ${expired.length} expired`);
    return { reminded: expiring.length, expired: expired.length };
  }
}
