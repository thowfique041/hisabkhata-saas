import { Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { expenseCategorySchema, expenseListQuerySchema, expenseSchema, PERMISSIONS } from '@hisabkhata/shared';
import { RequirePermissions, Tenant, ZBody, ZQuery } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@Controller()
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('expense-categories')
  @RequirePermissions(PERMISSIONS.EXPENSE_VIEW)
  categories(@Tenant() t: TenantContext) {
    return this.expenses.categories(t.tenantId);
  }

  @Post('expense-categories')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  createCategory(@Tenant() t: TenantContext, @ZBody(expenseCategorySchema) body: any) {
    return this.expenses.createCategory(t, body);
  }

  @Put('expense-categories/:id')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  updateCategory(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(expenseCategorySchema) body: any) {
    return this.expenses.updateCategory(t, id, body);
  }

  @Delete('expense-categories/:id')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  archiveCategory(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.expenses.archiveCategory(t, id);
  }

  @Get('expenses')
  @RequirePermissions(PERMISSIONS.EXPENSE_VIEW)
  list(@Tenant() t: TenantContext, @ZQuery(expenseListQuerySchema) q: any) {
    return this.expenses.list(t.tenantId, q);
  }

  @Post('expenses')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  create(@Tenant() t: TenantContext, @ZBody(expenseSchema) body: any) {
    return this.expenses.create(t, body);
  }

  @Put('expenses/:id')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  update(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(expenseSchema) body: any) {
    return this.expenses.update(t, id, body);
  }

  @Delete('expenses/:id')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  remove(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.expenses.remove(t, id);
  }
}
