import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import type { TenantContext } from '../../common/types';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.scoped(tenantId).category.findMany({
      where: { archivedAt: null },
      include: { _count: { select: { products: { where: { archivedAt: null } } } } },
      orderBy: { name: 'asc' },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async create(ctx: TenantContext, input: { name: string; description?: string }) {
    const c = await this.prisma.scoped(ctx.tenantId).category.create({
      data: { tenantId: ctx.tenantId, name: input.name, description: input.description },
    });
    await this.audit.log({ action: 'category.created', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Category', entityId: c.id });
    return c;
  }

  async update(ctx: TenantContext, id: string, input: { name: string; description?: string }) {
    const db = this.prisma.scoped(ctx.tenantId);
    if (!(await db.category.findFirst({ where: { id } }))) throw new NotFoundException('Category not found');
    return db.category.update({ where: { id }, data: { name: input.name, description: input.description ?? null } });
  }

  async remove(ctx: TenantContext, id: string) {
    const db = this.prisma.scoped(ctx.tenantId);
    const c = await db.category.findFirst({ where: { id }, include: { _count: { select: { products: { where: { archivedAt: null } } } } } });
    if (!c) throw new NotFoundException('Category not found');
    if (c._count.products) throw new BadRequestException(`Move or archive the ${c._count.products} products in this category first`);
    await db.category.delete({ where: { id } });
    await this.audit.log({ action: 'category.deleted', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Category', entityId: id });
    return { ok: true };
  }
}
