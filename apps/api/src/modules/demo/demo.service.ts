import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { AlertsService } from '../core/alerts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  DEMO_CATEGORIES,
  DEMO_CUSTOMERS,
  DEMO_EXPENSES,
  DEMO_PRODUCTS,
  DEMO_SUPPLIERS,
} from './demo-catalog';

const DAY = 86_400_000;
const DAYS = 60;

/** Small deterministic PRNG so every business gets a believable but reproducible shop. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const id = () => 'demo' + randomUUID().replace(/-/g, '').slice(0, 21);
const m = (n: number) => n.toFixed(2);
const q = (n: number) => n.toFixed(3);
const pad = (n: number, w: number) => String(n).padStart(w, '0');

type Event = {
  at: Date;
  productId: string;
  delta: number;
  type: 'PURCHASE' | 'SALE';
  refType: string;
  refId: string;
  unitCost: number;
  note: string;
};

export interface DemoStatus {
  loaded: boolean;
  products: number;
  sales: number;
  customers: number;
}

@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
    private readonly alerts: AlertsService,
  ) {}

  async status(tenantId: string): Promise<DemoStatus> {
    const [products, sales, customers] = await Promise.all([
      this.prisma.product.count({ where: { tenantId, isDemo: true } }),
      this.prisma.sale.count({ where: { tenantId, isDemo: true } }),
      this.prisma.customer.count({ where: { tenantId, isDemo: true } }),
    ]);
    return { loaded: products + sales + customers > 0, products, sales, customers };
  }

  /**
   * Seeds a sample grocery shop for this business: categories, 30 products, suppliers,
   * customers with dues, purchases, expenses and ~60 days of sales. Every row is tagged
   * isDemo so `remove` can take it out again without touching real records.
   * Demo documents use DEMO- numbers and never consume the real invoice/purchase counters.
   */
  async seed(tenantId: string, userId: string) {
    if ((await this.status(tenantId)).loaded)
      throw new ConflictException('Demo data is already loaded for this business');
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Business not found');
    await this.subscriptions.assertWithinLimit(tenantId, 'products', DEMO_PRODUCTS.length);

    const rand = rng(tenantId);
    const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
    const now = Date.now();
    const start = new Date(now - DAYS * DAY);
    // Shop hours (Dhaka 9am to 9pm) expressed in UTC: 03:00 to 15:00.
    const at = (daysAgo: number, hourUtc: number, minute = 0) => {
      const d = new Date(now - daysAgo * DAY);
      d.setUTCHours(hourUtc, minute, 0, 0);
      return d.getTime() > now ? new Date(now - 60_000) : d;
    };

    // ---- reference rows (reuse a category or expense category if the name already exists)
    const existingCats = await this.prisma.category.findMany({
      where: { tenantId, name: { in: DEMO_CATEGORIES } },
    });
    const categories = DEMO_CATEGORIES.map(
      (name) => existingCats.find((c) => c.name === name) ?? { id: id(), name, isNew: true },
    );
    const catId = new Map(categories.map((c) => [c.name, c.id]));

    // SKUs DEMO-001.. but skip any number a kept (now real) product from an earlier demo still uses.
    const takenSkus = new Set(
      (
        await this.prisma.product.findMany({
          where: { tenantId, sku: { startsWith: 'DEMO-' } },
          select: { sku: true },
        })
      ).map((p) => p.sku),
    );
    let skuNo = 0;
    const nextSku = () => {
      let sku: string;
      do sku = `DEMO-${pad(++skuNo, 3)}`;
      while (takenSkus.has(sku));
      return sku;
    };
    const products = DEMO_PRODUCTS.map((p) => ({ ...p, id: id(), sku: nextSku(), stock: 0 }));
    const suppliers = DEMO_SUPPLIERS.map((s) => ({ ...s, id: id() }));
    const customers = DEMO_CUSTOMERS.map((c) => ({ ...c, id: id() }));

    const events: Event[] = [];
    const purchases: any[] = [];
    const purchaseItems: any[] = [];
    const payments: any[] = [];
    const sales: any[] = [];
    const saleItems: any[] = [];
    const invoices: any[] = [];

    // ---- purchases: an opening delivery 60 days ago and a restock 30 days ago per supplier
    let poNo = 0;
    for (const round of [DAYS, 30]) {
      for (const s of suppliers) {
        const lines = products.filter((p) => s.categories.includes(p.category));
        const pid = id();
        const when = at(round, 4, 30);
        let total = 0;
        for (const p of lines) {
          // Enough for ~32 days, a little less on the restock so a few items end up low.
          const qty = Math.max(
            p.minStock + 2,
            Math.round(p.pace * (round === DAYS ? 34 : 27) * (0.85 + rand() * 0.3)),
          );
          const lineTotal = qty * p.cost;
          total += lineTotal;
          purchaseItems.push({
            id: id(),
            tenantId,
            purchaseId: pid,
            productId: p.id,
            productName: p.name,
            quantity: q(qty),
            unitCost: m(p.cost),
            lineTotal: m(lineTotal),
          });
          events.push({
            at: when,
            productId: p.id,
            delta: qty,
            type: 'PURCHASE',
            refType: 'PURCHASE',
            refId: pid,
            unitCost: p.cost,
            note: '',
          });
        }
        // Most deliveries are paid in full; the restock from two suppliers is left partly owed.
        const owes = round === 30 && (s === suppliers[0] || s === suppliers[2]);
        const paid = owes ? Math.round((total * (0.4 + rand() * 0.3)) / 100) * 100 : total;
        poNo++;
        const purchaseNo = `DEMO-PO-${pad(poNo, 3)}`;
        events.filter((e) => e.refId === pid).forEach((e) => (e.note = purchaseNo));
        purchases.push({
          id: pid,
          tenantId,
          purchaseNo,
          supplierId: s.id,
          purchaseDate: when,
          status: 'RECEIVED',
          paymentStatus: paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'DUE',
          subtotal: m(total),
          total: m(total),
          paidAmount: m(paid),
          dueAmount: m(total - paid),
          userId,
          createdAt: when,
          isDemo: true,
        });
        if (paid > 0) {
          payments.push({
            id: id(),
            tenantId,
            direction: 'OUT',
            kind: 'PURCHASE',
            method: pick(['CASH', 'BANK', 'BKASH']),
            amount: m(paid),
            purchaseId: pid,
            supplierId: s.id,
            userId,
            createdAt: when,
            isDemo: true,
          });
        }
      }
    }

    // ---- sales: walk the days in order, never selling stock that is not there
    const stockAt = new Map(products.map((p) => [p.id, 0]));
    const applyUntil = (t: Date) => {
      for (const e of events)
        if (e.type === 'PURCHASE' && e.at <= t && !(e as any).applied) {
          stockAt.set(e.productId, (stockAt.get(e.productId) ?? 0) + e.delta);
          (e as any).applied = true;
        }
    };
    let invNo = 0;
    for (let day = DAYS - 1; day >= 0; day--) {
      const date = new Date(now - day * DAY);
      const friday = date.getUTCDay() === 5;
      const count =
        day === 0 ? 3 + Math.floor(rand() * 3) : (friday ? 3 : 5) + Math.floor(rand() * 5);
      for (let k = 0; k < count; k++) {
        const when = at(day, 3 + Math.floor((k / count) * 12), Math.floor(rand() * 59));
        if (when.getTime() > now) continue;
        applyUntil(when);
        const nLines = 1 + Math.floor(rand() * 4);
        const chosen = new Set<number>();
        const lines: { p: (typeof products)[number]; qty: number }[] = [];
        for (let j = 0; j < nLines; j++) {
          // Faster-moving items are picked more often.
          const weights = products.map((p) => p.pace);
          let r = rand() * weights.reduce((a, b) => a + b, 0);
          let idx = 0;
          while (r > weights[idx]) r -= weights[idx++];
          if (chosen.has(idx)) continue;
          chosen.add(idx);
          const p = products[idx];
          const qty = p.unit === 'bag' ? 1 : 1 + Math.floor(rand() * (p.pace > 3 ? 3 : 2));
          if ((stockAt.get(p.id) ?? 0) < qty) continue;
          stockAt.set(p.id, (stockAt.get(p.id) ?? 0) - qty);
          lines.push({ p, qty });
        }
        if (!lines.length) continue;
        const sid = id();
        invNo++;
        const invoiceNo = `DEMO-${pad(invNo, 5)}`;
        const subtotal = lines.reduce((a, l) => a + l.qty * l.p.price, 0);
        const cost = lines.reduce((a, l) => a + l.qty * l.p.cost, 0);
        const credit = rand() < 0.14;
        const customer = credit || rand() < 0.2 ? pick(customers) : null;
        const paid = credit ? Math.floor((subtotal * rand() * 0.6) / 10) * 10 : subtotal;
        const roll = rand();
        const method = credit
          ? 'CASH'
          : roll < 0.6
            ? 'CASH'
            : roll < 0.85
              ? 'BKASH'
              : roll < 0.95
                ? 'NAGAD'
                : 'CARD';
        sales.push({
          id: sid,
          tenantId,
          invoiceNo,
          customerId: customer?.id ?? null,
          userId,
          status: 'COMPLETED',
          paymentStatus: paid >= subtotal ? 'PAID' : paid > 0 ? 'PARTIAL' : 'DUE',
          subtotal: m(subtotal),
          total: m(subtotal),
          paidAmount: m(paid),
          dueAmount: m(subtotal - paid),
          costTotal: m(cost),
          createdAt: when,
          isDemo: true,
        });
        invoices.push({
          id: id(),
          tenantId,
          saleId: sid,
          invoiceNo,
          issuedAt: when,
          createdAt: when,
        });
        for (const l of lines) {
          saleItems.push({
            id: id(),
            tenantId,
            saleId: sid,
            productId: l.p.id,
            productName: l.p.name,
            sku: l.p.sku,
            unit: l.p.unit,
            quantity: q(l.qty),
            unitPrice: m(l.p.price),
            unitCost: m(l.p.cost),
            lineTotal: m(l.qty * l.p.price),
          });
          events.push({
            at: when,
            productId: l.p.id,
            delta: -l.qty,
            type: 'SALE',
            refType: 'SALE',
            refId: sid,
            unitCost: l.p.cost,
            note: invoiceNo,
          });
        }
        if (paid > 0) {
          payments.push({
            id: id(),
            tenantId,
            direction: 'IN',
            kind: 'SALE',
            method,
            amount: m(paid),
            saleId: sid,
            customerId: customer?.id ?? null,
            userId,
            createdAt: when,
            isDemo: true,
          });
        }
      }
    }

    // ---- stock movements in time order, each with its running balance
    events.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.type === 'PURCHASE' ? -1 : 1));
    const balance = new Map(products.map((p) => [p.id, 0]));
    const movements = events.map((e) => {
      const after = (balance.get(e.productId) ?? 0) + e.delta;
      balance.set(e.productId, after);
      return {
        id: id(),
        tenantId,
        productId: e.productId,
        type: e.type,
        quantity: q(e.delta),
        balanceAfter: q(after),
        unitCost: m(e.unitCost),
        referenceType: e.refType,
        referenceId: e.refId,
        note: e.note,
        userId,
        createdAt: e.at,
      };
    });

    // ---- expenses
    const existingExpCats = await this.prisma.expenseCategory.findMany({
      where: { tenantId, name: { in: DEMO_EXPENSES.map((e) => e.category) } },
    });
    const expCats = DEMO_EXPENSES.map(
      (e) =>
        existingExpCats.find((c) => c.name === e.category) ?? {
          id: id(),
          name: e.category,
          isNew: true,
        },
    );
    const expenses: any[] = [];
    DEMO_EXPENSES.forEach((e, i) => {
      for (let day = DAYS - 2; day >= 0; day -= e.everyDays) {
        const amount = e.everyDays >= 30 ? e.amount : Math.round(e.amount * (0.8 + rand() * 0.4));
        expenses.push({
          id: id(),
          tenantId,
          categoryId: expCats[i].id,
          amount: m(amount),
          method: e.everyDays >= 30 ? 'BANK' : 'CASH',
          description: e.description,
          expenseDate: at(day, 5),
          userId,
          createdAt: at(day, 5),
          isDemo: true,
        });
      }
    });

    const created = new Date(start.getTime() - DAY);
    await this.prisma.$transaction(
      async (tx) => {
        await tx.category.createMany({
          data: categories
            .filter((c: any) => c.isNew)
            .map((c) => ({ id: c.id, tenantId, name: c.name, isDemo: true, createdAt: created })),
        });
        await tx.supplier.createMany({
          data: suppliers.map((s) => ({
            id: s.id,
            tenantId,
            name: s.name,
            phone: s.phone,
            isDemo: true,
            createdAt: created,
          })),
        });
        await tx.customer.createMany({
          data: customers.map((c) => ({
            id: c.id,
            tenantId,
            name: c.name,
            phone: c.phone,
            isDemo: true,
            createdAt: created,
          })),
        });
        await tx.product.createMany({
          data: products.map((p) => ({
            id: p.id,
            tenantId,
            categoryId: catId.get(p.category) ?? null,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
            purchasePrice: m(p.cost),
            sellingPrice: m(p.price),
            stock: q(balance.get(p.id) ?? 0),
            minStock: q(p.minStock),
            isDemo: true,
            createdAt: created,
          })),
        });
        await tx.purchase.createMany({ data: purchases });
        await tx.purchaseItem.createMany({ data: purchaseItems });
        await tx.sale.createMany({ data: sales });
        await tx.saleItem.createMany({ data: saleItems });
        await tx.invoice.createMany({ data: invoices });
        await tx.payment.createMany({ data: payments });
        await tx.stockMovement.createMany({ data: movements });
        await tx.expenseCategory.createMany({
          data: expCats
            .filter((c: any) => c.isNew)
            .map((c) => ({ id: c.id, tenantId, name: c.name, isDemo: true, createdAt: created })),
        });
        await tx.expense.createMany({ data: expenses });
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    await this.audit.log({
      action: 'demo.loaded',
      tenantId,
      userId,
      entity: 'Tenant',
      entityId: tenantId,
    });
    await this.alerts.invalidate(tenantId);
    return {
      ...(await this.status(tenantId)),
      purchases: purchases.length,
      expenses: expenses.length,
    };
  }

  /**
   * Deletes only rows tagged isDemo. Demo products, customers or suppliers that real records
   * now point to (someone sold a demo product for real) are kept so history stays intact.
   */
  async remove(tenantId: string, userId: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const demoSales = (
          await tx.sale.findMany({ where: { tenantId, isDemo: true }, select: { id: true } })
        ).map((s) => s.id);
        const demoPurchases = (
          await tx.purchase.findMany({ where: { tenantId, isDemo: true }, select: { id: true } })
        ).map((p) => p.id);

        await tx.stockMovement.deleteMany({
          where: {
            tenantId,
            OR: [
              { referenceType: 'SALE', referenceId: { in: demoSales } },
              { referenceType: 'PURCHASE', referenceId: { in: demoPurchases } },
            ],
          },
        });
        const payments = await tx.payment.deleteMany({
          where: {
            tenantId,
            OR: [
              { isDemo: true },
              { saleId: { in: demoSales } },
              { purchaseId: { in: demoPurchases } },
            ],
          },
        });
        const sales = await tx.sale.deleteMany({ where: { tenantId, id: { in: demoSales } } });
        const purchases = await tx.purchase.deleteMany({
          where: { tenantId, id: { in: demoPurchases } },
        });
        const expenses = await tx.expense.deleteMany({ where: { tenantId, isDemo: true } });
        await tx.expenseCategory.deleteMany({
          where: { tenantId, isDemo: true, expenses: { none: {} } },
        });

        const products = await tx.product.deleteMany({
          where: { tenantId, isDemo: true, saleItems: { none: {} }, purchaseItems: { none: {} } },
        });
        const keptProducts = await tx.product.count({ where: { tenantId, isDemo: true } });
        const customers = await tx.customer.deleteMany({
          where: { tenantId, isDemo: true, sales: { none: {} }, payments: { none: {} } },
        });
        const keptCustomers = await tx.customer.count({ where: { tenantId, isDemo: true } });
        const suppliers = await tx.supplier.deleteMany({
          where: { tenantId, isDemo: true, purchases: { none: {} }, payments: { none: {} } },
        });
        const keptSuppliers = await tx.supplier.count({ where: { tenantId, isDemo: true } });
        await tx.category.deleteMany({ where: { tenantId, isDemo: true, products: { none: {} } } });
        // Whatever had to stay is real now: untag it so the business can load demo data again later.
        await tx.product.updateMany({ where: { tenantId, isDemo: true }, data: { isDemo: false } });
        await tx.customer.updateMany({
          where: { tenantId, isDemo: true },
          data: { isDemo: false },
        });
        await tx.supplier.updateMany({
          where: { tenantId, isDemo: true },
          data: { isDemo: false },
        });
        await tx.category.updateMany({
          where: { tenantId, isDemo: true },
          data: { isDemo: false },
        });

        return {
          removed: {
            sales: sales.count,
            purchases: purchases.count,
            payments: payments.count,
            expenses: expenses.count,
            products: products.count,
            customers: customers.count,
            suppliers: suppliers.count,
          },
          kept: { products: keptProducts, customers: keptCustomers, suppliers: keptSuppliers },
        };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    await this.audit.log({
      action: 'demo.removed',
      tenantId,
      userId,
      entity: 'Tenant',
      entityId: tenantId,
    });
    await this.alerts.invalidate(tenantId, true);
    return result;
  }
}
