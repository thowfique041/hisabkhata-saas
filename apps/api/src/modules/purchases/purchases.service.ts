import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { CounterService } from '../core/counter.service';
import { StockService } from '../inventory/stock.service';
import { dec, money, paymentStatusFor, qty, sum } from '../../common/utils/decimal';
import { pageArgs, paginated } from '../../common/utils/pagination';
import type { TenantContext } from '../../common/types';
import type { PaymentMethod, Prisma } from '../../generated/prisma/client';

export interface CreatePurchaseInput {
  supplierId: string;
  reference?: string;
  purchaseDate?: Date;
  items: { productId: string; quantity: string; unitCost: string }[];
  discount: string;
  shippingCost: string;
  payments: { method: PaymentMethod; amount: string; reference?: string }[];
  note?: string;
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly counters: CounterService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, q: { page: number; pageSize: number; search?: string; supplierId?: string; status?: string; from?: Date; to?: Date }) {
    const db = this.prisma.scoped(tenantId);
    const where: Prisma.PurchaseWhereInput = {
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.from || q.to ? { purchaseDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.search
        ? { OR: [{ purchaseNo: { contains: q.search, mode: 'insensitive' } }, { reference: { contains: q.search, mode: 'insensitive' } }, { supplier: { name: { contains: q.search, mode: 'insensitive' } } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.purchase.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: { purchaseDate: 'desc' },
        ...pageArgs(q),
      }),
      db.purchase.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  async get(tenantId: string, id: string) {
    const p = await this.prisma.scoped(tenantId).purchase.findFirst({
      where: { id },
      include: { supplier: true, items: { include: { product: { select: { unit: true, sku: true } } } }, payments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!p) throw new NotFoundException('Purchase not found');
    return p;
  }

  async create(ctx: TenantContext, input: CreatePurchaseInput) {
    const tenantId = ctx.tenantId;
    const purchase = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId, archivedAt: null } });
      if (!supplier) throw new BadRequestException('Supplier not found');

      const productIds = [...new Set(input.items.map((i) => i.productId))];
      const products = await tx.product.findMany({ where: { tenantId, id: { in: productIds }, archivedAt: null } });
      if (products.length !== productIds.length) throw new BadRequestException('One or more products were not found');
      const byId = new Map(products.map((p) => [p.id, p]));

      const lines = input.items.map((i) => {
        const quantity = qty(i.quantity);
        const unitCost = money(i.unitCost);
        return { ...i, quantity, unitCost, lineTotal: money(quantity.times(unitCost)), product: byId.get(i.productId)! };
      });
      const subtotal = sum(lines.map((l) => l.lineTotal));
      const discount = money(input.discount);
      const shipping = money(input.shippingCost);
      if (discount.greaterThan(subtotal)) throw new BadRequestException('Discount cannot exceed the subtotal');
      const total = money(subtotal.minus(discount).plus(shipping));
      const paid = money(sum(input.payments.map((p) => p.amount)));
      if (paid.greaterThan(total)) throw new BadRequestException('Paid amount cannot exceed the purchase total');

      const n = await this.counters.next(tx, tenantId, 'purchase');
      const created = await tx.purchase.create({
        data: {
          tenantId,
          purchaseNo: this.counters.format('PO', n),
          supplierId: supplier.id,
          reference: input.reference,
          purchaseDate: input.purchaseDate ?? new Date(),
          status: 'RECEIVED',
          paymentStatus: paymentStatusFor(total, paid),
          subtotal,
          discount,
          shippingCost: shipping,
          total,
          paidAmount: paid,
          dueAmount: total.minus(paid),
          note: input.note,
          userId: ctx.userId,
          items: {
            create: lines.map((l) => ({
              tenantId,
              productId: l.productId,
              productName: l.product.name,
              quantity: l.quantity,
              unitCost: l.unitCost,
              lineTotal: l.lineTotal,
            })),
          },
        },
      });

      for (const l of lines) {
        await this.stock.move(tx, {
          tenantId,
          productId: l.productId,
          delta: l.quantity,
          type: 'PURCHASE',
          allowNegative: false,
          referenceType: 'PURCHASE',
          referenceId: created.id,
          unitCost: l.unitCost,
          userId: ctx.userId,
          note: created.purchaseNo,
        });
        // Latest landed cost becomes the product's purchase price (used for profit estimates).
        await tx.product.update({ where: { id: l.productId }, data: { purchasePrice: l.unitCost } });
      }

      for (const p of input.payments.filter((x) => dec(x.amount).greaterThan(0))) {
        await tx.payment.create({
          data: {
            tenantId,
            direction: 'OUT',
            kind: 'PURCHASE',
            method: p.method,
            amount: money(p.amount),
            reference: p.reference,
            purchaseId: created.id,
            supplierId: supplier.id,
            userId: ctx.userId,
          },
        });
      }
      return created;
    });
    await this.audit.log({ action: 'purchase.created', tenantId, userId: ctx.userId, entity: 'Purchase', entityId: purchase.id, metadata: { total: purchase.total.toFixed(2) } });
    return this.get(tenantId, purchase.id);
  }

  /** Reverses the stock received. Fails if those units were already sold (unless negative stock is allowed). */
  async cancel(ctx: TenantContext, id: string, reason?: string) {
    const tenantId = ctx.tenantId;
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.purchase.findFirst({ where: { id, tenantId }, include: { items: true } });
      if (!p) throw new NotFoundException('Purchase not found');
      const flipped = await tx.purchase.updateMany({
        where: { id, tenantId, status: 'RECEIVED' },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? null, dueAmount: 0 },
      });
      if (flipped.count !== 1) throw new ConflictException('This purchase is already cancelled');

      for (const item of p.items) {
        await this.stock.move(tx, {
          tenantId,
          productId: item.productId,
          delta: dec(item.quantity).negated(),
          type: 'PURCHASE_CANCEL',
          allowNegative: ctx.tenant.allowNegativeStock,
          referenceType: 'PURCHASE',
          referenceId: p.id,
          unitCost: item.unitCost,
          userId: ctx.userId,
          note: `Cancelled ${p.purchaseNo}`,
        });
      }
      if (dec(p.paidAmount).greaterThan(0)) {
        await tx.payment.create({
          data: {
            tenantId,
            direction: 'IN',
            kind: 'PURCHASE_REFUND',
            method: 'OTHER',
            amount: p.paidAmount,
            note: `Supplier refund for cancelled ${p.purchaseNo}`,
            purchaseId: p.id,
            supplierId: p.supplierId,
            userId: ctx.userId,
          },
        });
      }
    });
    await this.audit.log({ action: 'purchase.cancelled', tenantId, userId: ctx.userId, entity: 'Purchase', entityId: id, metadata: { reason } });
    return this.get(tenantId, id);
  }
}
