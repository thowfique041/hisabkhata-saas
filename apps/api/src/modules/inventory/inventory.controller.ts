import { Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  bulkProductActionSchema,
  categorySchema,
  listQuerySchema,
  PERMISSIONS,
  productListQuerySchema,
  productSchema,
  productUpdateSchema,
  stockAdjustmentSchema,
} from '@hisabkhata/shared';
import { RequirePermissions, Tenant, ZBody, ZQuery } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { CategoriesService } from './categories.service';
import { ProductsService } from './products.service';

@ApiTags('Inventory')
@Controller()
export class InventoryController {
  constructor(
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
  ) {}

  // ---- categories
  @Get('categories')
  @RequirePermissions(PERMISSIONS.PRODUCT_VIEW)
  listCategories(@Tenant() t: TenantContext) {
    return this.categories.list(t.tenantId);
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.CATEGORY_MANAGE)
  createCategory(@Tenant() t: TenantContext, @ZBody(categorySchema) body: any) {
    return this.categories.create(t, body);
  }

  @Put('categories/:id')
  @RequirePermissions(PERMISSIONS.CATEGORY_MANAGE)
  updateCategory(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(categorySchema) body: any) {
    return this.categories.update(t, id, body);
  }

  @Delete('categories/:id')
  @RequirePermissions(PERMISSIONS.CATEGORY_MANAGE)
  deleteCategory(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.categories.remove(t, id);
  }

  // ---- products
  @Get('products')
  @RequirePermissions(PERMISSIONS.PRODUCT_VIEW)
  list(@Tenant() t: TenantContext, @ZQuery(productListQuerySchema) q: any) {
    return this.products.list(t.tenantId, q);
  }

  @Get('products/lookup')
  @RequirePermissions(PERMISSIONS.PRODUCT_VIEW)
  lookup(@Tenant() t: TenantContext, @Query('code') code: string) {
    return this.products.lookup(t.tenantId, code ?? '');
  }

  @Get('products/:id')
  @RequirePermissions(PERMISSIONS.PRODUCT_VIEW)
  get(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.products.get(t.tenantId, id);
  }

  @Post('products')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  create(@Tenant() t: TenantContext, @ZBody(productSchema) body: any) {
    return this.products.create(t, body);
  }

  @Patch('products/:id')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  update(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(productUpdateSchema) body: any) {
    return this.products.update(t, id, body);
  }

  @Delete('products/:id')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  archive(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.products.setArchived(t, [id], true);
  }

  @Post('products/:id/restore')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  restore(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.products.setArchived(t, [id], false);
  }

  @Post('products/bulk')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  bulk(@Tenant() t: TenantContext, @ZBody(bulkProductActionSchema) body: any) {
    return this.products.bulk(t, body);
  }

  // ---- stock
  @Get('inventory/movements')
  @RequirePermissions(PERMISSIONS.STOCK_VIEW)
  movements(
    @Tenant() t: TenantContext,
    @ZQuery(listQuerySchema) q: any,
    @Query('productId') productId?: string,
    @Query('type') type?: string,
  ) {
    return this.products.movements(t.tenantId, { ...q, productId, type });
  }

  @Get('inventory/low-stock')
  @RequirePermissions(PERMISSIONS.STOCK_VIEW)
  lowStock(@Tenant() t: TenantContext) {
    return this.products.lowStock(t.tenantId);
  }

  @Post('inventory/adjustments')
  @RequirePermissions(PERMISSIONS.STOCK_ADJUST)
  adjust(@Tenant() t: TenantContext, @ZBody(stockAdjustmentSchema) body: any) {
    return this.products.adjust(t, body);
  }
}
