import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, money } from '../../common/utils/decimal';
import { NET_REVENUE_SQL } from './reports.service';

const s2 = (v: unknown) => money(dec(v as any)).toFixed(2);

/** Every number here is computed from the tenant's own records at request time. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const { timezone } = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    });

    // Local midnight and first-of-month in the business's timezone, as UTC instants.
    const [bounds] = await this.prisma.$queryRaw<
      { today: Date; month: Date; year: Date; days30: Date }[]
    >`
      SELECT (date_trunc('day', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC' AS today,
             (date_trunc('month', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC' AS month,
             (date_trunc('month', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone} - INTERVAL '11 months') AT TIME ZONE 'UTC' AS year,
             (date_trunc('day', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone} - INTERVAL '29 days') AT TIME ZONE 'UTC' AS days30`;

    const salesIn = (from: Date, to = new Date('9999-12-31')) => this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int AS orders, SUM(s."total" - s."refundedAmount") AS gross, SUM(${NET_REVENUE_SQL}) AS revenue, SUM(s."costTotal") AS cogs
        FROM "Sale" s WHERE s."tenantId" = ${tenantId} AND s."status" <> 'CANCELLED' AND s."createdAt" >= ${from} AND s."createdAt" < ${to}`;
    const expensesIn = (from: Date, to: Date) => this.prisma.$queryRaw<any[]>`
      SELECT SUM("amount") AS amount FROM "Expense" WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL AND "expenseDate" >= ${from} AND "expenseDate" < ${to}`;

    // Fair comparisons: today so far against yesterday up to the same time, this month so far
    // against the same number of days last month.
    const now = new Date();
    const [prev] = await this.prisma.$queryRaw<
      { yStart: Date; yNow: Date; lmStart: Date; lmNow: Date }[]
    >`
      SELECT ${bounds.today}::timestamp - INTERVAL '1 day' AS "yStart",
             ${now}::timestamp - INTERVAL '1 day' AS "yNow",
             ${bounds.month}::timestamp - INTERVAL '1 month' AS "lmStart",
             LEAST(${now}::timestamp - INTERVAL '1 month', ${bounds.month}::timestamp) AS "lmNow"`;

    const [
      [today],
      [month],
      [allTime],
      [monthExpenses],
      [allExpenses],
      productCounts,
      customers,
      [receivable],
      recentSales,
      recentInvoices,
      daily,
      monthly,
      monthlyExpenses,
      top,
      [yesterday],
      [lastMonth],
      [lastMonthExpenses],
    ] = await Promise.all([
      salesIn(bounds.today),
      salesIn(bounds.month),
      salesIn(new Date(0)),
      this.prisma.$queryRaw<
        any[]
      >`SELECT SUM("amount") AS amount FROM "Expense" WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL AND "expenseDate" >= ${bounds.month}`,
      this.prisma.$queryRaw<
        any[]
      >`SELECT SUM("amount") AS amount FROM "Expense" WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL`,
      this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE "stock" <= 0)::int AS out,
               COUNT(*) FILTER (WHERE "stock" > 0 AND "stock" <= "minStock")::int AS low
          FROM "Product" WHERE "tenantId" = ${tenantId} AND "archivedAt" IS NULL`,
      this.prisma.customer.count({ where: { tenantId, archivedAt: null } }),
      this.prisma.$queryRaw<
        any[]
      >`SELECT SUM("dueAmount") AS due, COUNT(*) FILTER (WHERE "dueAmount" > 0)::int AS count FROM "Sale" WHERE "tenantId" = ${tenantId} AND "status" <> 'CANCELLED'`,
      this.prisma.sale.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          invoiceNo: true,
          total: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, sale: { dueAmount: { gt: 0 }, status: { not: 'CANCELLED' } } },
        orderBy: { issuedAt: 'desc' },
        take: 6,
        select: {
          saleId: true,
          invoiceNo: true,
          issuedAt: true,
          sale: { select: { dueAmount: true, total: true, customer: { select: { name: true } } } },
        },
      }),
      this.prisma.$queryRaw<any[]>`
        SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(SUM(s."total" - s."refundedAmount"), 0) AS sales, COUNT(s."id")::int AS orders
          FROM generate_series(date_trunc('day', NOW() AT TIME ZONE ${timezone}) - INTERVAL '29 days', date_trunc('day', NOW() AT TIME ZONE ${timezone}), INTERVAL '1 day') d
          LEFT JOIN "Sale" s ON s."tenantId" = ${tenantId} AND s."status" <> 'CANCELLED'
               AND date_trunc('day', s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) = d
         GROUP BY d ORDER BY d`,
      this.prisma.$queryRaw<any[]>`
        SELECT to_char(m, 'YYYY-MM') AS month, COALESCE(SUM(${NET_REVENUE_SQL}), 0) AS revenue, COALESCE(SUM(s."costTotal"), 0) AS cogs
          FROM generate_series(date_trunc('month', NOW() AT TIME ZONE ${timezone}) - INTERVAL '11 months', date_trunc('month', NOW() AT TIME ZONE ${timezone}), INTERVAL '1 month') m
          LEFT JOIN "Sale" s ON s."tenantId" = ${tenantId} AND s."status" <> 'CANCELLED'
               AND date_trunc('month', s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) = m
         GROUP BY m ORDER BY m`,
      this.prisma.$queryRaw<any[]>`
        SELECT to_char(date_trunc('month', "expenseDate" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM') AS month, SUM("amount") AS amount
          FROM "Expense" WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL AND "expenseDate" >= ${bounds.year}
         GROUP BY 1`,
      this.prisma.$queryRaw<any[]>`
        SELECT si."productId", MAX(si."productName") AS name, SUM(si."quantity" - si."refundedQty") AS qty,
               SUM(si."lineTotal" * (si."quantity" - si."refundedQty") / NULLIF(si."quantity", 0)) AS revenue
          FROM "SaleItem" si JOIN "Sale" s ON s."id" = si."saleId"
         WHERE si."tenantId" = ${tenantId} AND s."status" <> 'CANCELLED' AND s."createdAt" >= ${bounds.month}
         GROUP BY si."productId" HAVING SUM(si."quantity" - si."refundedQty") > 0
         ORDER BY revenue DESC NULLS LAST LIMIT 5`,
      salesIn(prev.yStart, prev.yNow),
      salesIn(prev.lmStart, prev.lmNow),
      expensesIn(prev.lmStart, prev.lmNow),
    ]);

    const expByMonth = new Map(monthlyExpenses.map((e) => [e.month, e.amount]));
    const monthRevenue = dec(month?.revenue);
    const monthGrossProfit = monthRevenue.minus(dec(month?.cogs));
    const monthExp = dec(monthExpenses?.amount);

    return {
      timezone,
      kpis: {
        salesToday: s2(today?.gross),
        ordersToday: today?.orders ?? 0,
        salesThisMonth: s2(month?.gross),
        ordersThisMonth: month?.orders ?? 0,
        revenueThisMonth: s2(monthRevenue),
        totalRevenue: s2(allTime?.revenue),
        expensesThisMonth: s2(monthExp),
        totalExpenses: s2(allExpenses?.amount),
        netProfitThisMonth: s2(monthGrossProfit.minus(monthExp)),
        totalProducts: productCounts[0]?.total ?? 0,
        lowStock: productCounts[0]?.low ?? 0,
        outOfStock: productCounts[0]?.out ?? 0,
        totalCustomers: customers,
        pendingPayments: s2(receivable?.due),
        pendingInvoices: receivable?.count ?? 0,
      },
      /** Same-period values to compare the KPIs against (added; older clients ignore it). */
      comparisons: {
        salesYesterday: s2(yesterday?.gross),
        ordersYesterday: yesterday?.orders ?? 0,
        salesLastMonth: s2(lastMonth?.gross),
        ordersLastMonth: lastMonth?.orders ?? 0,
        expensesLastMonth: s2(lastMonthExpenses?.amount),
        netProfitLastMonth: s2(
          dec(lastMonth?.revenue).minus(dec(lastMonth?.cogs)).minus(dec(lastMonthExpenses?.amount)),
        ),
      },
      salesChart: daily.map((d) => ({ date: d.day, sales: s2(d.sales), orders: d.orders })),
      revenueChart: monthly.map((m) => ({
        month: m.month,
        revenue: s2(m.revenue),
        grossProfit: s2(dec(m.revenue).minus(dec(m.cogs))),
        expenses: s2(expByMonth.get(m.month)),
      })),
      topProducts: top.map((t) => ({
        productId: t.productId,
        name: t.name,
        qty: dec(t.qty).toString(),
        revenue: s2(t.revenue),
      })),
      recentSales,
      recentInvoices,
    };
  }
}
