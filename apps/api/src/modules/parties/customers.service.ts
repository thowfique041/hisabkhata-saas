import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { dec, money, minDec, paymentStatusFor, ZERO } from '../../common/utils/decimal';
import { pageArgs, paginated, orderBy } from '../../common/utils/pagination';
import type { TenantContext } from '../../common/types';
import type { PaymentMethod, Prisma } from '../../generated/prisma/client';

type PartyInput = { name: string; phone?: string; email?: string; address?: string; notes?: string };

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, q: { page: number; pageSize: number; search?: string; sort?: string; order: 'asc' | 'desc' }) {
    const db = this.prisma.scoped(tenantId);
    const where: Prisma.CustomerWhereInput = {
      archivedAt: null,
      ...(q.search
        ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { phone: { contains: q.search } }, { email: { contains: q.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.customer.findMany({ where, orderBy: orderBy(q.sort, q.sort ? q.order : 'asc', ['name', 'createdAt'] as const, 'name'), ...pageArgs(q) }),
      db.customer.count({ where }),
    ]);
    const stats = rows.length
      ? await db.sale.groupBy({
          by: ['customerId'],
          where: { customerId: { in: rows.map((r) => r.id) }, status: { not: 'CANCELLED' } },
          _sum: { total: true, refundedAmount: true, dueAmount: true },
          _count: { _all: true },
        })
      : [];
    const byId = new Map(stats.map((s) => [s.customerId, s]));
    const items = rows.map((c) => {
      const s = byId.get(c.id);
      return {
        ...c,
        salesCount: s?._count._all ?? 0,
        totalPurchases: money(dec(s?._sum.total).minus(dec(s?._sum.refundedAmount))).toFixed(2),
        outstanding: money(dec(s?._sum.dueAmount)).toFixed(2),
      };
    });
    return paginated(items, total, q);
  }

  async get(tenantId: string, id: string) {
    const db = this.prisma.scoped(tenantId);
    const customer = await db.customer.findFirst({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    const [agg, sales, payments] = await Promise.all([
      db.sale.aggregate({
        where: { customerId: id, status: { not: 'CANCELLED' } },
        _sum: { total: true, refundedAmount: true, dueAmount: true, paidAmount: true },
        _count: { _all: true },
      }),
      db.sale.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      db.payment.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return {
      ...customer,
      stats: {
        salesCount: agg._count._all,
        totalPurchases: money(dec(agg._sum.total).minus(dec(agg._sum.refundedAmount))).toFixed(2),
        totalPaid: money(dec(agg._sum.paidAmount)).toFixed(2),
        outstanding: money(dec(agg._sum.dueAmount)).toFixed(2),
      },
      sales,
      payments,
    };
  }

  async create(ctx: TenantContext, input: PartyInput) {
    const c = await this.prisma.scoped(ctx.tenantId).customer.create({ data: { tenantId: ctx.tenantId, ...input } });
    await this.audit.log({ action: 'customer.created', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Customer', entityId: c.id });
    return c;
  }

  async update(ctx: TenantContext, id: string, input: PartyInput) {
    const db = this.prisma.scoped(ctx.tenantId);
    if (!(await db.customer.findFirst({ where: { id } }))) throw new NotFoundException('Customer not found');
    return db.customer.update({
      where: { id },
      data: { name: input.name, phone: input.phone ?? null, email: input.email ?? null, address: input.address ?? null, notes: input.notes ?? null },
    });
  }

  async archive(ctx: TenantContext, id: string) {
    const db = this.prisma.scoped(ctx.tenantId);
    const c = await db.customer.findFirst({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found');
    const due = await db.sale.aggregate({ where: { customerId: id, status: { not: 'CANCELLED' } }, _sum: { dueAmount: true } });
    if (dec(due._sum.dueAmount).greaterThan(0)) throw new BadRequestException('This customer still has an outstanding balance');
    await db.customer.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({ action: 'customer.archived', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Customer', entityId: id });
    return { ok: true };
  }

  /** Collects a payment against a customer's dues, oldest sale first. */
  async receivePayment(ctx: TenantContext, id: string, input: { method: PaymentMethod; amount: string; reference?: string; note?: string }) {
    const amount = money(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('Amount must be greater than zero');
    const result = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!customer) throw new NotFoundException('Customer not found');
      const dueSales = await tx.sale.findMany({
        where: { tenantId: ctx.tenantId, customerId: id, status: { not: 'CANCELLED' }, dueAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      });
      const outstanding = dueSales.reduce((a, s) => a.plus(s.dueAmount), ZERO);
      if (amount.greaterThan(outstanding)) {
        throw new BadRequestException(`Amount exceeds the outstanding balance of ${outstanding.toFixed(2)}`);
      }
      let remaining = amount;
      const applied: { saleId: string; invoiceNo: string; amount: string }[] = [];
      for (const s of dueSales) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const part = minDec(remaining, dec(s.dueAmount));
        const paid = dec(s.paidAmount).plus(part);
        const due = dec(s.dueAmount).minus(part);
        // Optimistic guard: only apply if the sale's due has not changed concurrently.
        const upd = await tx.sale.updateMany({
          where: { id: s.id, tenantId: ctx.tenantId, dueAmount: s.dueAmount },
          data: { paidAmount: paid, dueAmount: due, paymentStatus: paymentStatusFor(dec(s.total).minus(s.refundedAmount), paid) },
        });
        if (upd.count !== 1) throw new BadRequestException('Balance changed while saving. Please retry.');
        await tx.payment.create({
          data: {
            tenantId: ctx.tenantId,
            direction: 'IN',
            kind: 'SALE_DUE',
            method: input.method,
            amount: part,
            reference: input.reference,
            note: input.note,
            saleId: s.id,
            customerId: id,
            userId: ctx.userId,
          },
        });
        applied.push({ saleId: s.id, invoiceNo: s.invoiceNo, amount: part.toFixed(2) });
        remaining = remaining.minus(part);
      }
      return { applied, outstandingAfter: outstanding.minus(amount).toFixed(2) };
    });
    await this.audit.log({ action: 'customer.payment_received', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Customer', entityId: id, metadata: { amount: amount.toFixed(2) } });
    return result;
  }

  /** Chronological ledger: invoices increase the balance, payments decrease it, refunds reduce it. */
  async statement(tenantId: string, id: string, from?: Date, to?: Date) {
    const db = this.prisma.scoped(tenantId);
    const customer = await db.customer.findFirst({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    const range = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const [sales, payments, opening] = await Promise.all([
      db.sale.findMany({ where: { customerId: id, createdAt: range }, orderBy: { createdAt: 'asc' } }),
      db.payment.findMany({ where: { customerId: id, createdAt: range }, orderBy: { createdAt: 'asc' } }),
      from ? this.balanceBefore(tenantId, id, from) : Promise.resolve(ZERO),
    ]);
    type Entry = { date: Date; type: string; reference: string; debit: string; credit: string; balance?: string };
    const entries: Entry[] = [];
    for (const s of sales) {
      entries.push({ date: s.createdAt, type: 'Invoice', reference: s.invoiceNo, debit: s.total.toFixed(2), credit: '0.00' });
      if (s.status === 'CANCELLED' && s.cancelledAt) {
        entries.push({ date: s.cancelledAt, type: 'Cancelled', reference: s.invoiceNo, debit: '0.00', credit: s.total.toFixed(2) });
      }
    }
    for (const p of payments) {
      if (p.direction === 'IN') {
        entries.push({ date: p.createdAt, type: 'Payment', reference: p.reference ?? p.method, debit: '0.00', credit: p.amount.toFixed(2) });
      } else {
        entries.push({ date: p.createdAt, type: 'Refund paid', reference: p.reference ?? p.method, debit: p.amount.toFixed(2), credit: '0.00' });
      }
    }
    // Refund credits (goods returned) reduce what the customer owes.
    for (const s of sales.filter((x) => dec(x.refundedAmount).greaterThan(0))) {
      entries.push({ date: s.updatedAt, type: 'Return', reference: s.invoiceNo, debit: '0.00', credit: s.refundedAmount.toFixed(2) });
    }
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());
    let bal = opening;
    for (const e of entries) {
      bal = bal.plus(e.debit).minus(e.credit);
      e.balance = bal.toFixed(2);
    }
    return { customer, opening: opening.toFixed(2), closing: bal.toFixed(2), entries };
  }

  private async balanceBefore(tenantId: string, customerId: string, before: Date) {
    const db = this.prisma.scoped(tenantId);
    const [s, cancelled, pin, pout] = await Promise.all([
      db.sale.aggregate({ where: { customerId, createdAt: { lt: before } }, _sum: { total: true, refundedAmount: true } }),
      db.sale.aggregate({ where: { customerId, status: 'CANCELLED', cancelledAt: { lt: before } }, _sum: { total: true } }),
      db.payment.aggregate({ where: { customerId, direction: 'IN', createdAt: { lt: before } }, _sum: { amount: true } }),
      db.payment.aggregate({ where: { customerId, direction: 'OUT', createdAt: { lt: before } }, _sum: { amount: true } }),
    ]);
    return dec(s._sum.total)
      .minus(dec(s._sum.refundedAmount))
      .minus(dec(cancelled._sum.total))
      .minus(dec(pin._sum.amount))
      .plus(dec(pout._sum.amount));
  }
}
