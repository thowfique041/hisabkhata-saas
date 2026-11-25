import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

const MINUTE = 60_000;
const DAY = 86_400_000;
/** Alerts are re-derived at most this often per business. */
const THROTTLE = 10 * MINUTE;

interface Alert {
  key: string;
  type: string;
  title: string;
  body: string;
  link: string;
  data: Prisma.InputJsonValue;
}

/** Calendar day in Dhaka, used to make one alert per day/week per kind. */
function dhakaDay(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(d);
}
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7)}`;
}

/**
 * Derives notifications from live data when someone opens the bell, instead of relying on a
 * scheduled job (the free deployment has no job runner). Each alert has a dedupe key, so it is
 * created once per day or week and keeps its read state; reading the bell never spams.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Call after bulk changes (demo data, imports) so the next read re-derives alerts at once.
   * `clear` drops the current live alerts too, for when the data they describe is gone.
   */
  async invalidate(tenantId: string, clear = false) {
    if (clear)
      await this.prisma.notification.deleteMany({ where: { tenantId, dedupeKey: { not: null } } });
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { alertsCheckedAt: null } });
  }

  async refresh(tenantId: string, force = false) {
    const now = new Date();
    if (!force) {
      // Claim the refresh atomically so concurrent requests do the work once.
      const claimed = await this.prisma.tenant.updateMany({
        where: {
          id: tenantId,
          OR: [
            { alertsCheckedAt: null },
            { alertsCheckedAt: { lt: new Date(now.getTime() - THROTTLE) } },
          ],
        },
        data: { alertsCheckedAt: now },
      });
      if (claimed.count === 0) return;
    } else {
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { alertsCheckedAt: now } });
    }
    try {
      const alerts = await this.derive(tenantId, now);
      for (const a of alerts) {
        await this.prisma.notification.upsert({
          where: { tenantId_dedupeKey: { tenantId, dedupeKey: a.key } },
          create: {
            tenantId,
            dedupeKey: a.key,
            type: a.type,
            title: a.title,
            body: a.body,
            link: a.link,
            data: a.data,
          },
          // Same period: refresh the numbers but keep whether it was read.
          update: { title: a.title, body: a.body, data: a.data },
        });
      }
    } catch (err) {
      this.logger.warn({ err, tenantId }, 'Could not derive alerts');
    }
  }

  private async derive(tenantId: string, now: Date): Promise<Alert[]> {
    const day = dhakaDay(now);
    const week = isoWeek(now);
    const out: Alert[] = [];

    const [low, out0] = await Promise.all([
      this.prisma.$queryRaw<{ name: string }[]>`
        SELECT name FROM "Product"
        WHERE "tenantId" = ${tenantId} AND "archivedAt" IS NULL AND "minStock" > 0 AND stock > 0 AND stock <= "minStock"
        ORDER BY stock ASC LIMIT 50`,
      this.prisma.product.findMany({
        where: { tenantId, archivedAt: null, stock: { lte: 0 } },
        select: { name: true },
        take: 50,
        orderBy: { name: 'asc' },
      }),
    ]);
    if (low.length) {
      out.push({
        key: `low-stock:${day}`,
        type: 'low-stock',
        title: `${low.length} products are low on stock`,
        body:
          low
            .slice(0, 3)
            .map((p) => p.name)
            .join(', ') + (low.length > 3 ? ' and more' : ''),
        link: '/products?stock=low',
        data: { count: low.length, names: low.slice(0, 3).map((p) => p.name) },
      });
    }
    if (out0.length) {
      out.push({
        key: `out-of-stock:${day}`,
        type: 'out-of-stock',
        title: `${out0.length} products are out of stock`,
        body:
          out0
            .slice(0, 3)
            .map((p) => p.name)
            .join(', ') + (out0.length > 3 ? ' and more' : ''),
        link: '/products?stock=out',
        data: { count: out0.length, names: out0.slice(0, 3).map((p) => p.name) },
      });
    }

    const overdue = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        tenantId,
        customerId: { not: null },
        dueAmount: { gt: 0 },
        status: { not: 'CANCELLED' },
        createdAt: { lt: new Date(now.getTime() - 30 * DAY) },
      },
      _sum: { dueAmount: true },
    });
    if (overdue.length) {
      const total = overdue.reduce((a, r) => a + Number(r._sum.dueAmount ?? 0), 0);
      out.push({
        key: `customer-dues:${week}`,
        type: 'customer-dues',
        title: `${overdue.length} customers owe you for more than 30 days`,
        body: `৳${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is overdue. Collect it from the customer's page.`,
        link: '/customers?dues=overdue',
        data: { count: overdue.length, amount: total.toFixed(2) },
      });
    }

    const owed = await this.prisma.purchase.aggregate({
      where: { tenantId, dueAmount: { gt: 0 }, status: { not: 'CANCELLED' } },
      _sum: { dueAmount: true },
    });
    const owedSuppliers = await this.prisma.purchase.groupBy({
      by: ['supplierId'],
      where: { tenantId, dueAmount: { gt: 0 }, status: { not: 'CANCELLED' } },
    });
    if (owedSuppliers.length) {
      const amount = Number(owed._sum.dueAmount ?? 0);
      out.push({
        key: `supplier-dues:${week}`,
        type: 'supplier-dues',
        title: `You owe ${owedSuppliers.length} suppliers`,
        body: `৳${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is still to be paid.`,
        link: '/suppliers?dues=owing',
        data: { count: owedSuppliers.length, amount: amount.toFixed(2) },
      });
    }

    const trial = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'TRIALING' },
      orderBy: { createdAt: 'desc' },
    });
    const ends = trial?.trialEndsAt ?? trial?.endsAt ?? null;
    if (trial && ends) {
      const daysLeft = Math.ceil((ends.getTime() - now.getTime()) / DAY);
      const bucket = [1, 3, 7].find((b) => daysLeft <= b);
      if (bucket && daysLeft >= 0) {
        out.push({
          key: `trial:${trial.id}:${bucket}`,
          type: 'trial-ending',
          title: daysLeft <= 1 ? 'Your trial ends today' : `Your trial ends in ${daysLeft} days`,
          body: 'Choose a plan to keep every feature. Your records stay safe either way.',
          link: '/subscription',
          data: { days: Math.max(0, daysLeft) },
        });
      }
    }
    return out;
  }
}
