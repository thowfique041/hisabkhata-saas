import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  cancelSchema,
  createSaleSchema,
  PERMISSIONS,
  receivePaymentSchema,
  refundSaleSchema,
  salesListQuerySchema,
} from '@hisabkhata/shared';
import { RequirePermissions, Tenant, ZBody, ZQuery } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { SalesService } from './sales.service';

@ApiTags('Sales & POS')
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALE_VIEW)
  list(@Tenant() t: TenantContext, @ZQuery(salesListQuerySchema) q: any) {
    return this.sales.list(t.tenantId, q);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALE_VIEW)
  get(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.sales.get(t.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALE_CREATE)
  create(@Tenant() t: TenantContext, @ZBody(createSaleSchema) body: any) {
    return this.sales.create(t, body);
  }

  @Post(':id/payments')
  @RequirePermissions(PERMISSIONS.PAYMENT_RECEIVE)
  pay(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(receivePaymentSchema) body: any) {
    return this.sales.receivePayment(t, id, body);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.SALE_CANCEL)
  cancel(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(cancelSchema) body: { reason?: string }) {
    return this.sales.cancel(t, id, body.reason);
  }

  @Post(':id/refunds')
  @RequirePermissions(PERMISSIONS.SALE_REFUND)
  refund(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(refundSaleSchema) body: any) {
    return this.sales.refund(t, id, body);
  }
}
