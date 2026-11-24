import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { pageArgs, paginated } from '../../common/utils/pagination';
import { dec, money } from '../../common/utils/decimal';
import type { TenantContext } from '../../common/types';
import type { PaymentMethod, Prisma } from '../../generated/prisma/client';

type ExpenseInput = { categoryId: string; amount: string; method: PaymentMethod; description?: string; expenseDate: Date; reference?: string };

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  categories(tenantId: string) {
    return this.prisma.scoped(tenantId).expenseCategory.findMany({ where: { archivedAt: null }, orderBy: { name: 'asc' } });
  }

  createCategory(ctx: TenantContext, input: { name: string; description?: string }) {
    return this.prisma.scoped(ctx.tenantId).expenseCategory.create({ data: { tenantId: ctx.tenantId, ...input } });
  }

  async updateCategory(ctx: TenantContext, id: string, input: { name: string; description?: string }) {
    const db = this.prisma.scoped(ctx.tenantId);
    if (!(await db.expenseCategory.findFirst({ where: { id } }))) throw new NotFoundException('Category not found');
    return db.expenseCategory.update({ where: { id }, data: { name: input.name, description: input.description ?? null } });
  }

  async archiveCategory(ctx: TenantContext, id: string) {
    const db = this.prisma.scoped(ctx.tenantId);
    if (!(await db.expenseCategory.findFirst({ where: { id } }))) throw new NotFoundException('Category not found');
    await db.expenseCategory.update({ where: { id }, data: { archivedAt: new Date() } });
    return { ok: true };
  }

  async list(tenantId: string, q: { page: number; pageSize: number; search?: string; categoryId?: string; from?: Date; to?: Date }) {
    const db = this.prisma.scoped(tenantId);
    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.from || q.to ? { expenseDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.search
        ? { OR: [{ description: { contains: q.search, mode: 'insensitive' } }, { reference: { contains: q.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [items, total, agg] = await Promise.all([
      db.expense.findMany({ where, include: { category: { select: { id: true, name: true } } }, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }], ...pageArgs(q) }),
      db.expense.count({ where }),
      db.expense.aggregate({ where, _sum: { amount: true } }),
    ]);
    return { ...paginated(items, total, q), totalAmount: money(dec(agg._sum.amount)).toFixed(2) };
  }

  private async assertCategory(tenantId: string, id: string) {
    const c = await this.prisma.expenseCategory.findFirst({ where: { id, tenantId, archivedAt: null } });
    if (!c) throw new BadRequestException('Expense category not found');
  }

  async create(ctx: TenantContext, input: ExpenseInput) {
    await this.assertCategory(ctx.tenantId, input.categoryId);
    const e = await this.prisma.scoped(ctx.tenantId).expense.create({ data: { tenantId: ctx.tenantId, userId: ctx.userId, ...input, amount: money(input.amount) } });
    await this.audit.log({ action: 'expense.created', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Expense', entityId: e.id, metadata: { amount: input.amount } });
    return e;
  }

  async update(ctx: TenantContext, id: string, input: ExpenseInput) {
    const db = this.prisma.scoped(ctx.tenantId);
    if (!(await db.expense.findFirst({ where: { id, deletedAt: null } }))) throw new NotFoundException('Expense not found');
    await this.assertCategory(ctx.tenantId, input.categoryId);
    const e = await db.expense.update({ where: { id }, data: { ...input, amount: money(input.amount), description: input.description ?? null, reference: input.reference ?? null } });
    await this.audit.log({ action: 'expense.updated', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Expense', entityId: id });
    return e;
  }

  async remove(ctx: TenantContext, id: string) {
    const db = this.prisma.scoped(ctx.tenantId);
    if (!(await db.expense.findFirst({ where: { id, deletedAt: null } }))) throw new NotFoundException('Expense not found');
    await db.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ action: 'expense.deleted', tenantId: ctx.tenantId, userId: ctx.userId, entity: 'Expense', entityId: id });
    return { ok: true };
  }
}
