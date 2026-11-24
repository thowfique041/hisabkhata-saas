import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, money } from '../../common/utils/decimal';

export type ColumnType = 'text' | 'money' | 'qty' | 'int' | 'date' | 'percent';
export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}
export interface Report {
  key: string;
  title: string;
  period: { from: string; to: string };
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  summary: { label: string; value: string; type: ColumnType; emphasis?: boolean }[];
}

/**
 * Definitions used consistently across every report and the dashboard:
 *  - Gross sales    = sale totals incl. tax, excl. cancelled sales
 *  - Net revenue    = (total - tax) less the returned share; i.e. after discounts and returns, before tax
 *  - COGS           = cost of goods sold at the purchase price captured on each sale line (net of returns)
 *  - Gross profit   = net revenue - COGS
 *  - Net profit     = gross profit - operating expenses
 */
export const NET_REVENUE_SQL = Prisma.sql`(s."total" - s."tax") * (1 - COALESCE(s."refundedAmount" / NULLIF(s."total", 0), 0))`;

const PERIOD_UNIT = { daily: 'day', weekly: 'week', monthly: 'month', annual: 'year' } as const;
export type Period = keyof typeof PERIOD_UNIT;

const s2 = (v: unknown) => money(dec(v as any)).toFixed(2);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async tenantTz(tenantId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { timezone: true, currency: true, name: true } });
    return t;
  }

  /** Default range: the last 30 days up to now. */
  range(from?: Date, to?: Date) {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 30 * 86_400_000);
    return { from: start, to: end };
  }

  private periodLabel(r: { from: Date; to: Date }) {
    return { from: r.from.toISOString(), to: r.to.toISOString() };
  }

  async sales(tenantId: string, from?: Date, to?: Date, period: Period = 'daily'): Promise<Report> {
    const r = this.range(from, to);
    const { timezone } = await this.tenantTz(tenantId);
    const unit = PERIOD_UNIT[period];
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT to_char(date_trunc(${unit}, s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM-DD') AS bucket,
             COUNT(*)::int AS orders,
             SUM(s."total") AS gross,
             SUM(s."discount" + s."itemDiscount") AS discounts,
             SUM(s."tax") AS tax,
             SUM(s."refundedAmount") AS returns,
             SUM(${NET_REVENUE_SQL}) AS revenue,
             SUM(s."costTotal") AS cogs,
             SUM(s."paidAmount") AS collected,
             SUM(s."dueAmount") AS due
        FROM "Sale" s
       WHERE s."tenantId" = ${tenantId} AND s."status" <> 'CANCELLED'
         AND s."createdAt" >= ${r.from} AND s."createdAt" <= ${r.to}
       GROUP BY 1 ORDER BY 1`;
    const out = rows.map((x) => ({
      period: x.bucket,
      orders: x.orders,
      gross: s2(x.gross),
      discounts: s2(x.discounts),
      tax: s2(x.tax),
      returns: s2(x.returns),
      revenue: s2(x.revenue),
      cogs: s2(x.cogs),
      grossProfit: s2(dec(x.revenue).minus(dec(x.cogs))),
      collected: s2(x.collected),
      due: s2(x.due),
    }));
    const tot = (k: keyof (typeof out)[number]) => s2(out.reduce((a, x) => a.plus(dec(x[k] as string)), dec(0)));
    return {
      key: 'sales',
      title: `${period[0].toUpperCase()}${period.slice(1)} sales report`,
      period: this.periodLabel(r),
      columns: [
        { key: 'period', label: 'Period', type: 'text' },
        { key: 'orders', label: 'Orders', type: 'int' },
        { key: 'gross', label: 'Gross sales', type: 'money' },
        { key: 'discounts', label: 'Discounts', type: 'money' },
        { key: 'returns', label: 'Returns', type: 'money' },
        { key: 'tax', label: 'Tax', type: 'money' },
        { key: 'revenue', label: 'Net revenue', type: 'money' },
        { key: 'cogs', label: 'Cost of goods', type: 'money' },
        { key: 'grossProfit', label: 'Gross profit', type: 'money' },
        { key: 'due', label: 'Due', type: 'money' },
      ],
      rows: out,
      summary: [
        { label: 'Orders', value: String(out.reduce((a, x) => a + x.orders, 0)), type: 'int' },
        { label: 'Gross sales', value: tot('gross'), type: 'money' },
        { label: 'Net revenue', value: tot('revenue'), type: 'money', emphasis: true },
        { label: 'Gross profit', value: tot('grossProfit'), type: 'money' },
        { label: 'Outstanding', value: tot('due'), type: 'money' },
      ],
    };
  }

  async profitLoss(tenantId: string, from?: Date, to?: Date): Promise<Report> {
    const r = this.range(from, to);
    const [[s], expenses] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT SUM(s."total") AS gross, SUM(s."discount" + s."itemDiscount") AS discounts, SUM(s."tax") AS tax,
               SUM(s."refundedAmount") AS returns, SUM(${NET_REVENUE_SQL}) AS revenue, SUM(s."costTotal") AS cogs
          FROM "Sale" s
         WHERE s."tenantId" = ${tenantId} AND s."status" <> 'CANCELLED'
           AND s."createdAt" >= ${r.from} AND s."createdAt" <= ${r.to}`,
      this.prisma.$queryRaw<any[]>`
        SELECT c."name" AS category, SUM(e."amount") AS amount
          FROM "Expense" e JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
         WHERE e."tenantId" = ${tenantId} AND e."deletedAt" IS NULL
           AND e."expenseDate" >= ${r.from} AND e."expenseDate" <= ${r.to}
         GROUP BY c."name" ORDER BY SUM(e."amount") DESC`,
    ]);
    const revenue = money(dec(s?.revenue));
    const cogs = money(dec(s?.cogs));
    const grossProfit = revenue.minus(cogs);
    const totalExpenses = money(expenses.reduce((a, e) => a.plus(dec(e.amount)), dec(0)));
    const netProfit = grossProfit.minus(totalExpenses);
    const margin = revenue.isZero() ? '0.00' : netProfit.dividedBy(revenue).times(100).toFixed(2);
    return {
      key: 'profit-loss',
      title: 'Profit and loss',
      period: this.periodLabel(r),
      columns: [
        { key: 'line', label: 'Line', type: 'text' },
        { key: 'amount', label: 'Amount', type: 'money' },
      ],
      rows: [
        { line: 'Gross sales (incl. tax)', amount: s2(s?.gross) },
        { line: 'Less: returns', amount: s2(s?.returns) },
        { line: 'Less: tax collected', amount: s2(s?.tax) },
        { line: 'Net revenue', amount: revenue.toFixed(2) },
        { line: 'Cost of goods sold', amount: cogs.toFixed(2) },
        { line: 'Gross profit', amount: grossProfit.toFixed(2) },
        ...expenses.map((e) => ({ line: `Expense: ${e.category}`, amount: s2(e.amount) })),
        { line: 'Total expenses', amount: totalExpenses.toFixed(2) },
        { line: 'Net profit', amount: netProfit.toFixed(2) },
      ],
      summary: [
        { label: 'Net revenue', value: revenue.toFixed(2), type: 'money' },
        { label: 'Gross profit', value: grossProfit.toFixed(2), type: 'money' },
        { label: 'Expenses', value: totalExpenses.toFixed(2), type: 'money' },
        { label: 'Net profit', value: netProfit.toFixed(2), type: 'money', emphasis: true },
        { label: 'Net margin', value: margin, type: 'percent' },
      ],
    };
  }

  async inventory(tenantId: string, onlyLow = false): Promise<Report> {
    const products = await this.prisma.product.findMany({
      where: { tenantId, archivedAt: null, ...(onlyLow ? { stock: { lte: this.prisma.product.fields.minStock } } : {}) },
      include: { category: { select: { name: true } } },
      orderBy: onlyLow ? { stock: 'asc' } : { name: 'asc' },
    });
    const rows = products.map((p) => ({
      name: p.name,
      sku: p.sku,
      category: p.category?.name ?? '',
      unit: p.unit,
      stock: p.stock.toString(),
      minStock: p.minStock.toString(),
      costValue: s2(p.stock.times(p.purchasePrice)),
      retailValue: s2(p.stock.times(p.sellingPrice)),
    }));
    const now = new Date().toISOString();
    return {
      key: onlyLow ? 'low-stock' : 'inventory',
      title: onlyLow ? 'Low stock report' : 'Inventory valuation',
      period: { from: now, to: now },
      columns: [
        { key: 'name', label: 'Product', type: 'text' },
        { key: 'sku', label: 'SKU', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' },
        { key: 'stock', label: 'In stock', type: 'qty' },
        { key: 'minStock', label: 'Minimum', type: 'qty' },
        { key: 'costValue', label: 'Cost value', type: 'money' },
        { key: 'retailValue', label: 'Retail value', type: 'money' },
      ],
      rows,
      summary: [
        { label: 'Products', value: String(rows.length), type: 'int' },
        { label: 'Out of stock', value: String(products.filter((p) => p.stock.lessThanOrEqualTo(0)).length), type: 'int' },
        { label: 'Stock at cost', value: s2(rows.reduce((a, x) => a.plus(x.costValue), dec(0))), type: 'money', emphasis: true },
        { label: 'Stock at retail', value: s2(rows.reduce((a, x) => a.plus(x.retailValue), dec(0))), type: 'money' },
      ],
    };
  }

  async topProducts(tenantId: string, from?: Date, to?: Date, limit = 20): Promise<Report> {
    const r = this.range(from, to);
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT si."productId", MAX(si."productName") AS name, MAX(si."sku") AS sku,
             SUM(si."quantity" - si."refundedQty") AS qty,
             SUM(si."lineTotal" * (si."quantity" - si."refundedQty") / NULLIF(si."quantity", 0)) AS revenue,
             SUM(si."unitCost" * (si."quantity" - si."refundedQty")) AS cost
        FROM "SaleItem" si JOIN "Sale" s ON s."id" = si."saleId"
       WHERE si."tenantId" = ${tenantId} AND s."status" <> 'CANCELLED'
         AND s."createdAt" >= ${r.from} AND s."createdAt" <= ${r.to}
       GROUP BY si."productId"
      HAVING SUM(si."quantity" - si."refundedQty") > 0
       ORDER BY revenue DESC NULLS LAST
       LIMIT ${limit}`;
    return {
      key: 'top-products',
      title: 'Top-selling products',
      period: this.periodLabel(r),
      columns: [
        { key: 'name', label: 'Product', type: 'text' },
        { key: 'sku', label: 'SKU', type: 'text' },
        { key: 'qty', label: 'Units sold', type: 'qty' },
        { key: 'revenue', label: 'Sales (before order discount)', type: 'money' },
        { key: 'profit', label: 'Gross profit', type: 'money' },
      ],
      rows: rows.map((x) => ({
        productId: x.productId,
        name: x.name,
        sku: x.sku,
        qty: dec(x.qty).toString(),
        revenue: s2(x.revenue),
        profit: s2(dec(x.revenue).minus(dec(x.cost))),
      })),
      summary: [],
    };
  }

  async purchases(tenantId: string, from?: Date, to?: Date): Promise<Report> {
    const r = this.range(from, to);
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT sp."name" AS supplier, COUNT(*)::int AS orders, SUM(p."total") AS total, SUM(p."paidAmount") AS paid, SUM(p."dueAmount") AS due
        FROM "Purchase" p JOIN "Supplier" sp ON sp."id" = p."supplierId"
       WHERE p."tenantId" = ${tenantId} AND p."status" = 'RECEIVED'
         AND p."purchaseDate" >= ${r.from} AND p."purchaseDate" <= ${r.to}
       GROUP BY sp."name" ORDER BY SUM(p."total") DESC`;
    const sum = (k: string) => s2(rows.reduce((a, x) => a.plus(dec(x[k])), dec(0)));
    return {
      key: 'purchases',
      title: 'Purchase report',
      period: this.periodLabel(r),
      columns: [
        { key: 'supplier', label: 'Supplier', type: 'text' },
        { key: 'orders', label: 'Purchases', type: 'int' },
        { key: 'total', label: 'Total', type: 'money' },
        { key: 'paid', label: 'Paid', type: 'money' },
        { key: 'due', label: 'Payable', type: 'money' },
      ],
      rows: rows.map((x) => ({ supplier: x.supplier, orders: x.orders, total: s2(x.total), paid: s2(x.paid), due: s2(x.due) })),
      summary: [
        { label: 'Total purchased', value: sum('total'), type: 'money', emphasis: true },
        { label: 'Paid', value: sum('paid'), type: 'money' },
        { label: 'Payable', value: sum('due'), type: 'money' },
      ],
    };
  }

  async customers(tenantId: string, from?: Date, to?: Date): Promise<Report> {
    const r = this.range(from, to);
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT c."name", c."phone", COUNT(s."id")::int AS orders,
             SUM(s."total" - s."refundedAmount") AS purchases, SUM(s."paidAmount") AS paid, SUM(s."dueAmount") AS due
        FROM "Customer" c JOIN "Sale" s ON s."customerId" = c."id"
       WHERE c."tenantId" = ${tenantId} AND s."status" <> 'CANCELLED'
         AND s."createdAt" >= ${r.from} AND s."createdAt" <= ${r.to}
       GROUP BY c."id" ORDER BY purchases DESC LIMIT 200`;
    return {
      key: 'customers',
      title: 'Customer report',
      period: this.periodLabel(r),
      columns: [
        { key: 'name', label: 'Customer', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'orders', label: 'Orders', type: 'int' },
        { key: 'purchases', label: 'Purchases', type: 'money' },
        { key: 'paid', label: 'Paid', type: 'money' },
        { key: 'due', label: 'Outstanding', type: 'money' },
      ],
      rows: rows.map((x) => ({ name: x.name, phone: x.phone, orders: x.orders, purchases: s2(x.purchases), paid: s2(x.paid), due: s2(x.due) })),
      summary: [{ label: 'Customers with purchases', value: String(rows.length), type: 'int' }],
    };
  }

  async expenses(tenantId: string, from?: Date, to?: Date): Promise<Report> {
    const r = this.range(from, to);
    const { timezone } = await this.tenantTz(tenantId);
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT to_char(date_trunc('month', e."expenseDate" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM') AS month,
             c."name" AS category, COUNT(*)::int AS entries, SUM(e."amount") AS amount
        FROM "Expense" e JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
       WHERE e."tenantId" = ${tenantId} AND e."deletedAt" IS NULL
         AND e."expenseDate" >= ${r.from} AND e."expenseDate" <= ${r.to}
       GROUP BY 1, 2 ORDER BY 1, SUM(e."amount") DESC`;
    return {
      key: 'expenses',
      title: 'Expense report',
      period: this.periodLabel(r),
      columns: [
        { key: 'month', label: 'Month', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' },
        { key: 'entries', label: 'Entries', type: 'int' },
        { key: 'amount', label: 'Amount', type: 'money' },
      ],
      rows: rows.map((x) => ({ month: x.month, category: x.category, entries: x.entries, amount: s2(x.amount) })),
      summary: [{ label: 'Total expenses', value: s2(rows.reduce((a, x) => a.plus(dec(x.amount)), dec(0))), type: 'money', emphasis: true }],
    };
  }

  async payments(tenantId: string, from?: Date, to?: Date): Promise<Report> {
    const r = this.range(from, to);
    const [byMethod, [recv], [pay]] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT p."method", p."direction", SUM(p."amount") AS amount, COUNT(*)::int AS count
          FROM "Payment" p
         WHERE p."tenantId" = ${tenantId} AND p."createdAt" >= ${r.from} AND p."createdAt" <= ${r.to}
         GROUP BY 1, 2 ORDER BY 1, 2`,
      this.prisma.$queryRaw<any[]>`SELECT SUM("dueAmount") AS due FROM "Sale" WHERE "tenantId" = ${tenantId} AND "status" <> 'CANCELLED'`,
      this.prisma.$queryRaw<any[]>`SELECT SUM("dueAmount") AS due FROM "Purchase" WHERE "tenantId" = ${tenantId} AND "status" = 'RECEIVED'`,
    ]);
    const methods = [...new Set(byMethod.map((x) => x.method as string))];
    const pick = (m: string, d: string) => byMethod.find((x) => x.method === m && x.direction === d);
    const rows = methods.map((m) => ({
      method: m,
      received: s2(pick(m, 'IN')?.amount),
      paidOut: s2(pick(m, 'OUT')?.amount),
      net: s2(dec(pick(m, 'IN')?.amount).minus(dec(pick(m, 'OUT')?.amount))),
    }));
    return {
      key: 'payments',
      title: 'Payments and dues',
      period: this.periodLabel(r),
      columns: [
        { key: 'method', label: 'Method', type: 'text' },
        { key: 'received', label: 'Received', type: 'money' },
        { key: 'paidOut', label: 'Paid out', type: 'money' },
        { key: 'net', label: 'Net', type: 'money' },
      ],
      rows,
      summary: [
        { label: 'Receivable from customers', value: s2(recv?.due), type: 'money', emphasis: true },
        { label: 'Payable to suppliers', value: s2(pay?.due), type: 'money' },
      ],
    };
  }
}
