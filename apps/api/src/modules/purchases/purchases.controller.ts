import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { cancelSchema, createPurchaseSchema, isoDate, listQuerySchema, PERMISSIONS } from '@hisabkhata/shared';
import { RequirePermissions, Tenant, ZBody, ZQuery } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { PurchasesService } from './purchases.service';

const purchaseListQuery = listQuerySchema.extend({
  supplierId: z.string().optional(),
  status: z.enum(['RECEIVED', 'CANCELLED']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

@ApiTags('Purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PURCHASE_VIEW)
  list(@Tenant() t: TenantContext, @ZQuery(purchaseListQuery) q: any) {
    return this.purchases.list(t.tenantId, q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PURCHASE_VIEW)
  get(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.purchases.get(t.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PURCHASE_MANAGE)
  create(@Tenant() t: TenantContext, @ZBody(createPurchaseSchema) body: any) {
    return this.purchases.create(t, body);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.PURCHASE_CANCEL)
  cancel(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(cancelSchema) body: { reason?: string }) {
    return this.purchases.cancel(t, id, body.reason);
  }
}
