import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, StockMovementType } from '../../generated/prisma/client';
import { dec, type Decimal } from '../../common/utils/decimal';

export interface StockMove {
  tenantId: string;
  productId: string;
  /** Signed quantity: positive adds stock, negative removes it. */
  delta: Decimal;
  type: StockMovementType;
  allowNegative: boolean;
  referenceType?: string;
  referenceId?: string;
  unitCost?: Decimal | null;
  userId?: string | null;
  reason?: string | null;
  note?: string | null;
}

/**
 * The only code path allowed to change Product.stock. Every change writes a StockMovement in the
 * same transaction. The conditional UPDATE is atomic at row level, so concurrent sales cannot both
 * pass the "enough stock" check and drive stock negative.
 */
@Injectable()
export class StockService {
  async move(tx: Prisma.TransactionClient, m: StockMove) {
    if (m.delta.isZero()) throw new ConflictException('Quantity must not be zero');
    const delta = m.delta.toFixed(3);
    const rows = await tx.$queryRaw<{ stock: Prisma.Decimal; name: string }[]>`
      UPDATE "Product"
         SET "stock" = "stock" + ${delta}::numeric, "updatedAt" = NOW()
       WHERE "id" = ${m.productId}
         AND "tenantId" = ${m.tenantId}
         AND (${m.allowNegative} OR "stock" + ${delta}::numeric >= 0)
      RETURNING "stock", "name"`;

    if (!rows.length) {
      const product = await tx.product.findFirst({
        where: { id: m.productId, tenantId: m.tenantId },
        select: { name: true, stock: true, unit: true },
      });
      if (!product) throw new NotFoundException('Product not found');
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: `Not enough stock for ${product.name}. Available: ${dec(product.stock).toString()} ${product.unit}`,
        productId: m.productId,
      });
    }

    await tx.stockMovement.create({
      data: {
        tenantId: m.tenantId,
        productId: m.productId,
        type: m.type,
        quantity: delta,
        balanceAfter: rows[0].stock,
        unitCost: m.unitCost ?? null,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        userId: m.userId ?? null,
        reason: m.reason ?? null,
        note: m.note ?? null,
      },
    });
    return dec(rows[0].stock);
  }
}
