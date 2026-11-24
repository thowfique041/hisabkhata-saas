import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProductInput } from '@hisabkhata/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { CounterService } from '../core/counter.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StockService } from './stock.service';
import { dec } from '../../common/utils/decimal';
import { orderBy, pageArgs, paginated } from '../../common/utils/pagination';
import type { TenantContext } from '../../common/types';
import type { Prisma } from '../../generated/prisma/client';

const SORTABLE = ['name', 'sku', 'sellingPrice', 'stock', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly counters: CounterService,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async list(
    tenantId: string,
    q: { page: number; pageSize: number; search?: string; sort?: string; order: 'asc' | 'desc'; categoryId?: string; stock: 'all' | 'low' | 'out'; archived: boolean },
  ) {
    const db = this.prisma.scoped(tenantId);
    const where: Prisma.ProductWhereInput = {
      tenantId,
      archivedAt: q.archived ? { not: null } : null,
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { sku: { contains: q.search, mode: 'insensitive' } },
              { barcode: { equals: q.search } },
            ],
          }
        : {}),
      ...(q.stock === 'out' ? { stock: { lte: 0 } } : {}),
      ...(q.stock === 'low' ? { stock: { gt: 0, lte: this.prisma.product.fields.minStock } } : {}),
    };
    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: orderBy(q.sort, q.sort ? q.order : 'asc', SORTABLE, 'name'),
        ...pageArgs(q),
      }),
      db.product.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  async get(tenantId: string, id: string) {
    const product = await this.prisma.scoped(tenantId).product.findFirst({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 25 },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** Exact barcode or SKU match for the POS scanner. */
  async lookup(tenantId: string, code: string) {
    const c = code.trim();
    const product = await this.prisma.scoped(tenantId).product.findFirst({
      where: { archivedAt: null, OR: [{ barcode: c }, { sku: c.toUpperCase() }] },
    });
    if (!product) throw new NotFoundException(`No product with code ${c}`);
    return product;
  }

  private async validateRefs(tenantId: string, input: Partial<ProductInput>) {
    if (input.categoryId) {
      const cat = await this.prisma.category.findFirst({ where: { id: input.categoryId, tenantId } });
      if (!cat) throw new BadRequestException('Category not found');
    }
    if (input.imageId) {
      const file = await this.prisma.fileAsset.findFirst({ where: { id: input.imageId, tenantId, kind: 'PRODUCT_IMAGE' } });
      if (!file) throw new BadRequestException('Image not found');
      return file.url;
    }
    return undefined;
  }

  async create(ctx: TenantContext, input: ProductInput) {
    await this.subscriptions.assertWithinLimit(ctx.tenantId, 'products');
    const imageUrl = await this.validateRefs(ctx.tenantId, input);

    const product = await this.prisma.$transaction(async (tx) => {
      const sku = input.sku ?? `SKU-${String(await this.counters.next(tx, ctx.tenantId, 'sku')).padStart(5, '0')}`;
      const p = await tx.product.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          sku,
          barcode: input.barcode ?? null,
          categoryId: input.categoryId ?? null,
          unit: input.unit,
          purchasePrice: input.purchasePrice,
          sellingPrice: input.sellingPrice,
          taxRate: input.taxRate,
          minStock: input.minStock,
          description: input.description,
          imageId: input.imageId ?? null,
          imageUrl: imageUrl ?? null,
        },
      });
      const opening = dec(input.openingStock ?? 0);
      if (opening.greaterThan(0)) {
        await this.stock.move(tx, {
          tenantId: ctx.tenantId,
          productId: p.id,
          delta: opening,
          type: 'OPENING',
          allowNegative: false,
          unitCost: dec(input.purchasePrice),
          userId: ctx.userId,
          note: 'Opening stock',
        });
      }
      return p;
    });
    await this.audit.log({ action: 'product.created', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Product', entityId: product.id });
    return this.get(ctx.tenantId, product.id);
  }

  async update(ctx: TenantContext, id: string, input: Partial<ProductInput>) {
    await this.get(ctx.tenantId, id);
    const imageUrl = await this.validateRefs(ctx.tenantId, input);
    const data: Prisma.ProductUncheckedUpdateInput = {
      name: input.name,
      sku: input.sku,
      barcode: input.barcode === undefined ? undefined : input.barcode || null,
      categoryId: input.categoryId === undefined ? undefined : input.categoryId,
      unit: input.unit,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      taxRate: input.taxRate,
      minStock: input.minStock,
      description: input.description,
      ...(input.imageId !== undefined ? { imageId: input.imageId, imageUrl: imageUrl ?? null } : {}),
    };
    await this.prisma.scoped(ctx.tenantId).product.update({ where: { id }, data });
    await this.audit.log({ action: 'product.updated', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Product', entityId: id });
    return this.get(ctx.tenantId, id);
  }

  async setArchived(ctx: TenantContext, ids: string[], archived: boolean) {
    if (!archived) {
      await this.subscriptions.assertWithinLimit(ctx.tenantId, 'products', ids.length);
    }
    const res = await this.prisma.scoped(ctx.tenantId).product.updateMany({
      where: { id: { in: ids } },
      data: { archivedAt: archived ? new Date() : null },
    });
    await this.audit.log({
      action: archived ? 'product.archived' : 'product.restored',
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      entity: 'Product',
      metadata: { ids },
    });
    return { updated: res.count };
  }

  async bulk(ctx: TenantContext, input: { ids: string[]; action: 'archive' | 'restore' | 'setCategory'; categoryId?: string | null }) {
    if (input.action === 'archive') return this.setArchived(ctx, input.ids, true);
    if (input.action === 'restore') return this.setArchived(ctx, input.ids, false);
    if (input.categoryId) await this.validateRefs(ctx.tenantId, { categoryId: input.categoryId });
    const res = await this.prisma.scoped(ctx.tenantId).product.updateMany({
      where: { id: { in: input.ids } },
      data: { categoryId: input.categoryId ?? null },
    });
    return { updated: res.count };
  }

  async movements(tenantId: string, q: { page: number; pageSize: number; productId?: string; type?: string }) {
    const db = this.prisma.scoped(tenantId);
    const where: Prisma.StockMovementWhereInput = {
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.type ? { type: q.type as any } : {}),
    };
    const [items, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      db.stockMovement.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  async adjust(
    ctx: TenantContext,
    input: { productId: string; direction: 'IN' | 'OUT'; quantity: string; reason: string; note?: string },
  ) {
    const q = dec(input.quantity);
    const balance = await this.prisma.$transaction((tx) =>
      this.stock.move(tx, {
        tenantId: ctx.tenantId,
        productId: input.productId,
        delta: input.direction === 'IN' ? q : q.negated(),
        type: input.direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        allowNegative: ctx.tenant.allowNegativeStock,
        referenceType: 'ADJUSTMENT',
        userId: ctx.userId,
        reason: input.reason,
        note: input.note,
      }),
    );
    await this.audit.log({
      action: 'stock.adjusted',
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      entity: 'Product',
      entityId: input.productId,
      metadata: { direction: input.direction, quantity: input.quantity, reason: input.reason },
    });
    return { productId: input.productId, stock: balance.toString() };
  }

  async lowStock(tenantId: string) {
    return this.prisma.scoped(tenantId).product.findMany({
      where: { archivedAt: null, stock: { lte: this.prisma.product.fields.minStock } },
      orderBy: { stock: 'asc' },
      take: 200,
    });
  }
}
