import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PERMISSIONS, type CreateSaleInput } from '@hisabkhata/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { CounterService } from '../core/counter.service';
import { StockService } from '../inventory/stock.service';
import { dec, minDec, money, paymentStatusFor, pct, qty, sum, ZERO, Decimal } from '../../common/utils/decimal';
import { pageArgs, paginated } from '../../common/utils/pagination';
import type { TenantContext } from '../../common/types';
import { Prisma, type PaymentMethod } from '../../generated/prisma/client';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly counters: CounterService,
    private readonly audit: AuditService,
  ) {}

  async list(
    tenantId: string,
    q: { page: number; pageSize: number; search?: string; status?: string; paymentStatus?: string; customerId?: string; from?: Date; to?: Date },
  ) {
    const db = this.prisma.scoped(tenantId);
    const where: Prisma.SaleWhereInput = {
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.paymentStatus ? { paymentStatus: q.paymentStatus as any } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.search
        ? { OR: [{ invoiceNo: { contains: q.search, mode: 'insensitive' } }, { customer: { name: { contains: q.search, mode: 'insensitive' } } }, { customer: { phone: { contains: q.search } } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: { customer: { select: { id: true, name: true, phone: true } }, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      db.sale.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  async get(tenantId: string, id: string) {
    const sale = await this.prisma.scoped(tenantId).sale.findFirst({
      where: { id },
      include: { customer: true, items: true, payments: { orderBy: { createdAt: 'asc' } }, invoice: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  /**
   * Creates a sale atomically: sale + items + stock decrement + stock movements + payments + invoice.
   * Any failure (e.g. insufficient stock) rolls back everything, including the invoice number.
   */
  async create(ctx: TenantContext, input: CreateSaleInput) {
    const tenantId = ctx.tenantId;
    if (input.idempotencyKey) {
      const existing = await this.prisma.sale.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey } });
      if (existing) return { ...(await this.get(tenantId, existing.id)), change: '0.00', replayed: true };
    }
    const canOverridePrice = ctx.permissions.has(PERMISSIONS.PRODUCT_MANAGE);

    try {
      const { saleId, change } = await this.prisma.$transaction(async (tx) => {
        if (input.customerId) {
          const c = await tx.customer.findFirst({ where: { id: input.customerId, tenantId, archivedAt: null } });
          if (!c) throw new BadRequestException('Customer not found');
        }
        const productIds = [...new Set(input.items.map((i) => i.productId))];
        const products = await tx.product.findMany({ where: { tenantId, id: { in: productIds }, archivedAt: null } });
        if (products.length !== productIds.length) throw new BadRequestException('One or more products are unavailable');
        const byId = new Map(products.map((p) => [p.id, p]));

        const lines = input.items.map((i) => {
          const product = byId.get(i.productId)!;
          if (i.unitPrice !== undefined && !dec(i.unitPrice).equals(product.sellingPrice) && !canOverridePrice) {
            throw new ForbiddenException('You are not allowed to change product prices at checkout');
          }
          const quantity = qty(i.quantity);
          const unitPrice = money(i.unitPrice ?? product.sellingPrice);
          const gross = money(quantity.times(unitPrice));
          const lineDiscount = money(i.discount);
          if (lineDiscount.greaterThan(gross)) throw new BadRequestException(`Discount on ${product.name} exceeds its price`);
          return { product, quantity, unitPrice, lineDiscount, lineTotal: gross.minus(lineDiscount), unitCost: dec(product.purchasePrice) };
        });

        const subtotal = sum(lines.map((l) => l.lineTotal));
        const itemDiscount = sum(lines.map((l) => l.lineDiscount));
        const discount = money(input.discount);
        if (discount.greaterThan(subtotal)) throw new BadRequestException('Discount cannot exceed the subtotal');
        const taxRate = dec(input.taxRate ?? ctx.tenant.defaultTaxRate);
        const tax = pct(subtotal.minus(discount), taxRate);
        const total = money(subtotal.minus(discount).plus(tax));

        // Tendered vs. applied: cash over-payment becomes change, never stored revenue.
        const payments = input.payments.filter((p) => dec(p.amount).greaterThan(0)).map((p) => ({ ...p, amount: money(p.amount) }));
        const tendered = sum(payments.map((p) => p.amount));
        let change = ZERO;
        if (tendered.greaterThan(total)) {
          change = tendered.minus(total);
          const cash = payments.find((p) => p.method === 'CASH' && p.amount.greaterThanOrEqualTo(change));
          if (!cash) throw new BadRequestException('Only cash payments can exceed the total');
          cash.amount = cash.amount.minus(change);
        }
        const paid = sum(payments.map((p) => p.amount));
        const due = total.minus(paid);
        if (due.greaterThan(0) && !input.customerId) {
          throw new BadRequestException('Select a customer to record a sale with an amount due');
        }

        const n = await this.counters.next(tx, tenantId, 'invoice');
        const invoiceNo = this.counters.format(ctx.tenant.invoicePrefix, n);
        const sale = await tx.sale.create({
          data: {
            tenantId,
            invoiceNo,
            customerId: input.customerId ?? null,
            userId: ctx.userId,
            status: 'COMPLETED',
            paymentStatus: paymentStatusFor(total, paid),
            subtotal,
            itemDiscount,
            discount,
            taxRate,
            tax,
            total,
            paidAmount: paid,
            dueAmount: due,
            costTotal: money(sum(lines.map((l) => l.unitCost.times(l.quantity)))),
            note: input.note,
            idempotencyKey: input.idempotencyKey ?? null,
            items: {
              create: lines.map((l) => ({
                tenantId,
                productId: l.product.id,
                productName: l.product.name,
                sku: l.product.sku,
                unit: l.product.unit,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                unitCost: l.unitCost,
                discount: l.lineDiscount,
                lineTotal: l.lineTotal,
              })),
            },
          },
        });

        // Lock order is deterministic (sorted by product id) to avoid deadlocks between concurrent sales.
        for (const l of [...lines].sort((a, b) => a.product.id.localeCompare(b.product.id))) {
          await this.stock.move(tx, {
            tenantId,
            productId: l.product.id,
            delta: l.quantity.negated(),
            type: 'SALE',
            allowNegative: ctx.tenant.allowNegativeStock,
            referenceType: 'SALE',
            referenceId: sale.id,
            unitCost: l.unitCost,
            userId: ctx.userId,
            note: invoiceNo,
          });
        }

        for (const p of payments.filter((x) => x.amount.greaterThan(0))) {
          await tx.payment.create({
            data: {
              tenantId,
              direction: 'IN',
              kind: 'SALE',
              method: p.method,
              amount: p.amount,
              reference: p.reference,
              saleId: sale.id,
              customerId: input.customerId ?? null,
              userId: ctx.userId,
            },
          });
        }
        await tx.invoice.create({ data: { tenantId, saleId: sale.id, invoiceNo } });
        return { saleId: sale.id, change };
      });

      await this.audit.log({ action: 'sale.created', tenantId, userId: ctx.userId, entity: 'Sale', entityId: saleId });
      return { ...(await this.get(tenantId, saleId)), change: change.toFixed(2) };
    } catch (err) {
      // A concurrent retry with the same idempotency key won the race: return its result.
      if (input.idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.sale.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey } });
        if (existing) return { ...(await this.get(tenantId, existing.id)), change: '0.00', replayed: true };
      }
      throw err;
    }
  }

  async receivePayment(ctx: TenantContext, saleId: string, input: { method: PaymentMethod; amount: string; reference?: string; note?: string }) {
    const amount = money(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('Amount must be greater than zero');
    await this.prisma.$transaction(async (tx) => {
      const s = await tx.sale.findFirst({ where: { id: saleId, tenantId: ctx.tenantId } });
      if (!s) throw new NotFoundException('Sale not found');
      if (s.status === 'CANCELLED') throw new BadRequestException('This sale was cancelled');
      if (amount.greaterThan(s.dueAmount)) throw new BadRequestException(`Amount exceeds the due of ${s.dueAmount.toFixed(2)}`);
      const paid = dec(s.paidAmount).plus(amount);
      const upd = await tx.sale.updateMany({
        where: { id: s.id, tenantId: ctx.tenantId, dueAmount: s.dueAmount },
        data: { paidAmount: paid, dueAmount: dec(s.dueAmount).minus(amount), paymentStatus: paymentStatusFor(dec(s.total).minus(s.refundedAmount), paid) },
      });
      if (upd.count !== 1) throw new ConflictException('Balance changed while saving. Please retry.');
      await tx.payment.create({
        data: {
          tenantId: ctx.tenantId,
          direction: 'IN',
          kind: 'SALE_DUE',
          method: input.method,
          amount,
          reference: input.reference,
          note: input.note,
          saleId: s.id,
          customerId: s.customerId,
          userId: ctx.userId,
        },
      });
    });
    await this.audit.log({ action: 'sale.payment_received', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Sale', entityId: saleId, metadata: { amount: amount.toFixed(2) } });
    return this.get(ctx.tenantId, saleId);
  }

  /** Full cancellation: restocks every item and refunds everything that was paid. */
  async cancel(ctx: TenantContext, id: string, reason?: string) {
    await this.prisma.$transaction(async (tx) => {
      const s = await tx.sale.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { items: true } });
      if (!s) throw new NotFoundException('Sale not found');
      if (dec(s.refundedAmount).greaterThan(0)) throw new BadRequestException('This sale has refunds. Refund the remaining items instead.');
      const flipped = await tx.sale.updateMany({
        where: { id, tenantId: ctx.tenantId, status: 'COMPLETED' },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? null, dueAmount: 0, paidAmount: 0 },
      });
      if (flipped.count !== 1) throw new ConflictException('This sale cannot be cancelled');
      for (const item of s.items) {
        await this.stock.move(tx, {
          tenantId: ctx.tenantId,
          productId: item.productId,
          delta: dec(item.quantity),
          type: 'SALE_CANCEL',
          allowNegative: true,
          referenceType: 'SALE',
          referenceId: s.id,
          unitCost: item.unitCost,
          userId: ctx.userId,
          note: `Cancelled ${s.invoiceNo}`,
        });
      }
      if (dec(s.paidAmount).greaterThan(0)) {
        await tx.payment.create({
          data: {
            tenantId: ctx.tenantId,
            direction: 'OUT',
            kind: 'SALE_REFUND',
            method: 'CASH',
            amount: s.paidAmount,
            note: `Refund for cancelled ${s.invoiceNo}`,
            saleId: s.id,
            customerId: s.customerId,
            userId: ctx.userId,
          },
        });
      }
    });
    await this.audit.log({ action: 'sale.cancelled', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Sale', entityId: id, metadata: { reason } });
    return this.get(ctx.tenantId, id);
  }

  /**
   * Partial or full return. The refund value is the returned share of the sale total (so order
   * discount and tax are returned proportionally). It first reduces any amount the customer still
   * owes; only the remainder is paid back.
   */
  async refund(ctx: TenantContext, id: string, input: { items: { saleItemId: string; quantity: string }[]; method: PaymentMethod; reason?: string }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const s = await tx.sale.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { items: true } });
      if (!s) throw new NotFoundException('Sale not found');
      if (s.status === 'CANCELLED' || s.status === 'REFUNDED') throw new BadRequestException('Nothing left to refund on this sale');

      let returnedNet = ZERO;
      let costReturned = ZERO;
      for (const r of input.items) {
        const item = s.items.find((i) => i.id === r.saleItemId);
        if (!item) throw new BadRequestException('Item does not belong to this sale');
        const q = qty(r.quantity);
        const refundable = dec(item.quantity).minus(item.refundedQty);
        if (q.greaterThan(refundable)) throw new BadRequestException(`Only ${refundable.toString()} of ${item.productName} can be returned`);
        returnedNet = returnedNet.plus(dec(item.lineTotal).times(q).dividedBy(item.quantity));
        costReturned = costReturned.plus(dec(item.unitCost).times(q));
        await tx.saleItem.update({ where: { id: item.id }, data: { refundedQty: dec(item.refundedQty).plus(q) } });
        await this.stock.move(tx, {
          tenantId: ctx.tenantId,
          productId: item.productId,
          delta: q,
          type: 'SALE_RETURN',
          allowNegative: true,
          referenceType: 'SALE',
          referenceId: s.id,
          unitCost: item.unitCost,
          userId: ctx.userId,
          reason: input.reason,
          note: `Return on ${s.invoiceNo}`,
        });
      }
      const remainingValue = dec(s.total).minus(s.refundedAmount);
      let refundValue = dec(s.subtotal).isZero() ? ZERO : money(dec(s.total).times(returnedNet).dividedBy(s.subtotal));
      const allReturned = s.items.every((i) => {
        const r = input.items.filter((x) => x.saleItemId === i.id).reduce((a, x) => a.plus(qty(x.quantity)), ZERO);
        return dec(i.refundedQty).plus(r).equals(i.quantity);
      });
      // Rounding guard: the final return settles exactly what is left.
      if (allReturned || refundValue.greaterThan(remainingValue)) refundValue = remainingValue;

      const dueReduction = minDec(refundValue, dec(s.dueAmount));
      const cashBack = refundValue.minus(dueReduction);
      const refunded = dec(s.refundedAmount).plus(refundValue);
      const paid = dec(s.paidAmount).minus(cashBack);
      await tx.sale.update({
        where: { id: s.id },
        data: {
          refundedAmount: refunded,
          dueAmount: dec(s.dueAmount).minus(dueReduction),
          paidAmount: paid,
          costTotal: money(dec(s.costTotal).minus(costReturned)),
          status: allReturned ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          paymentStatus: paymentStatusFor(dec(s.total).minus(refunded), paid),
        },
      });
      if (cashBack.greaterThan(0)) {
        await tx.payment.create({
          data: {
            tenantId: ctx.tenantId,
            direction: 'OUT',
            kind: 'SALE_REFUND',
            method: input.method,
            amount: cashBack,
            note: input.reason ?? `Return on ${s.invoiceNo}`,
            saleId: s.id,
            customerId: s.customerId,
            userId: ctx.userId,
          },
        });
      }
      return { refundValue, cashBack };
    });
    await this.audit.log({
      action: 'sale.refunded',
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      entity: 'Sale',
      entityId: id,
      metadata: { value: result.refundValue.toFixed(2), cashBack: result.cashBack.toFixed(2) },
    });
    return { ...(await this.get(ctx.tenantId, id)), refundValue: result.refundValue.toFixed(2), cashBack: result.cashBack.toFixed(2) };
  }
}

export type { Decimal };
