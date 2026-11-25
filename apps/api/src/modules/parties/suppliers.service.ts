import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { dec, money, minDec, paymentStatusFor, ZERO } from '../../common/utils/decimal';
import { orderBy, pageArgs, paginated } from '../../common/utils/pagination';
import type { TenantContext } from '../../common/types';
import type { PaymentMethod, Prisma } from '../../generated/prisma/client';

type SupplierInput = {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    tenantId: string,
    q: {
      page: number;
      pageSize: number;
      search?: string;
      sort?: string;
      order: 'asc' | 'desc';
      dues?: 'all' | 'owing' | 'overdue';
    },
  ) {
    const db = this.prisma.scoped(tenantId);
    const owing: Prisma.PurchaseWhereInput = { dueAmount: { gt: 0 }, status: { not: 'CANCELLED' } };
    const where: Prisma.SupplierWhereInput = {
      archivedAt: null,
      ...(q.dues === 'owing'
        ? { purchases: { some: owing } }
        : q.dues === 'overdue'
          ? {
              purchases: {
                some: { ...owing, purchaseDate: { lt: new Date(Date.now() - 30 * 86_400_000) } },
              },
            }
          : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { company: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy: orderBy(q.sort, q.sort ? q.order : 'asc', ['name', 'createdAt'] as const, 'name'),
        ...pageArgs(q),
      }),
      db.supplier.count({ where }),
    ]);
    const stats = rows.length
      ? await db.purchase.groupBy({
          by: ['supplierId'],
          where: { supplierId: { in: rows.map((r) => r.id) }, status: 'RECEIVED' },
          _sum: { total: true, dueAmount: true },
          _count: { _all: true },
        })
      : [];
    const byId = new Map(stats.map((s) => [s.supplierId, s]));
    return paginated(
      rows.map((s) => ({
        ...s,
        purchaseCount: byId.get(s.id)?._count._all ?? 0,
        totalPurchased: money(dec(byId.get(s.id)?._sum.total)).toFixed(2),
        payable: money(dec(byId.get(s.id)?._sum.dueAmount)).toFixed(2),
      })),
      total,
      q,
    );
  }

  async get(tenantId: string, id: string) {
    const db = this.prisma.scoped(tenantId);
    const supplier = await db.supplier.findFirst({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const [agg, purchases, payments] = await Promise.all([
      db.purchase.aggregate({
        where: { supplierId: id, status: 'RECEIVED' },
        _sum: { total: true, paidAmount: true, dueAmount: true },
        _count: { _all: true },
      }),
      db.purchase.findMany({
        where: { supplierId: id },
        orderBy: { purchaseDate: 'desc' },
        take: 20,
      }),
      db.payment.findMany({ where: { supplierId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return {
      ...supplier,
      stats: {
        purchaseCount: agg._count._all,
        totalPurchased: money(dec(agg._sum.total)).toFixed(2),
        totalPaid: money(dec(agg._sum.paidAmount)).toFixed(2),
        payable: money(dec(agg._sum.dueAmount)).toFixed(2),
      },
      purchases,
      payments,
    };
  }

  async create(ctx: TenantContext, input: SupplierInput) {
    const s = await this.prisma
      .scoped(ctx.tenantId)
      .supplier.create({ data: { tenantId: ctx.tenantId, ...input } });
    await this.audit.log({
      action: 'supplier.created',
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      entity: 'Supplier',
      entityId: s.id,
    });
    return s;
  }

  async update(ctx: TenantContext, id: string, input: SupplierInput) {
    const db = this.prisma.scoped(ctx.tenantId);
    if (!(await db.supplier.findFirst({ where: { id } })))
      throw new NotFoundException('Supplier not found');
    return db.supplier.update({
      where: { id },
      data: {
        name: input.name,
        company: input.company ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async archive(ctx: TenantContext, id: string) {
    const db = this.prisma.scoped(ctx.tenantId);
    if (!(await db.supplier.findFirst({ where: { id } })))
      throw new NotFoundException('Supplier not found');
    const due = await db.purchase.aggregate({
      where: { supplierId: id, status: 'RECEIVED' },
      _sum: { dueAmount: true },
    });
    if (dec(due._sum.dueAmount).greaterThan(0))
      throw new BadRequestException('You still owe this supplier. Settle the balance first.');
    await db.supplier.update({ where: { id }, data: { archivedAt: new Date() } });
    return { ok: true };
  }

  /** Pays a supplier against outstanding purchases, oldest first. */
  async pay(
    ctx: TenantContext,
    id: string,
    input: { method: PaymentMethod; amount: string; reference?: string; note?: string },
  ) {
    const amount = money(input.amount);
    if (amount.lessThanOrEqualTo(0))
      throw new BadRequestException('Amount must be greater than zero');
    const result = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!supplier) throw new NotFoundException('Supplier not found');
      const due = await tx.purchase.findMany({
        where: { tenantId: ctx.tenantId, supplierId: id, status: 'RECEIVED', dueAmount: { gt: 0 } },
        orderBy: { purchaseDate: 'asc' },
      });
      const payable = due.reduce((a, p) => a.plus(p.dueAmount), ZERO);
      if (amount.greaterThan(payable))
        throw new BadRequestException(
          `Amount exceeds the payable balance of ${payable.toFixed(2)}`,
        );
      let remaining = amount;
      for (const p of due) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const part = minDec(remaining, dec(p.dueAmount));
        const paid = dec(p.paidAmount).plus(part);
        const upd = await tx.purchase.updateMany({
          where: { id: p.id, tenantId: ctx.tenantId, dueAmount: p.dueAmount },
          data: {
            paidAmount: paid,
            dueAmount: dec(p.dueAmount).minus(part),
            paymentStatus: paymentStatusFor(dec(p.total), paid),
          },
        });
        if (upd.count !== 1)
          throw new BadRequestException('Balance changed while saving. Please retry.');
        await tx.payment.create({
          data: {
            tenantId: ctx.tenantId,
            direction: 'OUT',
            kind: 'PURCHASE_DUE',
            method: input.method,
            amount: part,
            reference: input.reference,
            note: input.note,
            purchaseId: p.id,
            supplierId: id,
            userId: ctx.userId,
          },
        });
        remaining = remaining.minus(part);
      }
      return { payableAfter: payable.minus(amount).toFixed(2) };
    });
    await this.audit.log({
      action: 'supplier.paid',
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      entity: 'Supplier',
      entityId: id,
      metadata: { amount: amount.toFixed(2) },
    });
    return result;
  }
}
