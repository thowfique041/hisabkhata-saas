import { Controller, Delete, Get, Param, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  customerSchema,
  dateRangeSchema,
  partyListQuerySchema,
  PERMISSIONS,
  receivePaymentSchema,
  supplierSchema,
} from '@hisabkhata/shared';
import { RequirePermissions, Tenant, ZBody, ZQuery } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { toCsv } from '../../common/utils/csv';
import { CustomersService } from './customers.service';
import { SuppliersService } from './suppliers.service';

const statementQuery = dateRangeSchema.extend({ format: z.enum(['json', 'csv']).default('json') });

@ApiTags('Customers & Suppliers')
@Controller()
export class PartiesController {
  constructor(
    private readonly customers: CustomersService,
    private readonly suppliers: SuppliersService,
  ) {}

  @Get('customers')
  @RequirePermissions(PERMISSIONS.CUSTOMER_VIEW)
  listCustomers(@Tenant() t: TenantContext, @ZQuery(partyListQuerySchema) q: any) {
    return this.customers.list(t.tenantId, q);
  }

  @Get('customers/:id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_VIEW)
  getCustomer(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.customers.get(t.tenantId, id);
  }

  @Get('customers/:id/statement')
  @RequirePermissions(PERMISSIONS.CUSTOMER_VIEW)
  async statement(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @ZQuery(statementQuery) q: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const s = await this.customers.statement(t.tenantId, id, q.from, q.to);
    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="statement-${id}.csv"`);
      return toCsv(
        ['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance'],
        s.entries.map((e) => [
          e.date.toISOString(),
          e.type,
          e.reference,
          e.debit,
          e.credit,
          e.balance ?? '',
        ]),
      );
    }
    return s;
  }

  @Post('customers')
  @RequirePermissions(PERMISSIONS.CUSTOMER_MANAGE)
  createCustomer(@Tenant() t: TenantContext, @ZBody(customerSchema) body: any) {
    return this.customers.create(t, body);
  }

  @Put('customers/:id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_MANAGE)
  updateCustomer(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @ZBody(customerSchema) body: any,
  ) {
    return this.customers.update(t, id, body);
  }

  @Delete('customers/:id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_MANAGE)
  archiveCustomer(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.customers.archive(t, id);
  }

  @Post('customers/:id/payments')
  @RequirePermissions(PERMISSIONS.PAYMENT_RECEIVE)
  receive(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @ZBody(receivePaymentSchema) body: any,
  ) {
    return this.customers.receivePayment(t, id, body);
  }

  @Get('suppliers')
  @RequirePermissions(PERMISSIONS.SUPPLIER_VIEW)
  listSuppliers(@Tenant() t: TenantContext, @ZQuery(partyListQuerySchema) q: any) {
    return this.suppliers.list(t.tenantId, q);
  }

  @Get('suppliers/:id')
  @RequirePermissions(PERMISSIONS.SUPPLIER_VIEW)
  getSupplier(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.suppliers.get(t.tenantId, id);
  }

  @Post('suppliers')
  @RequirePermissions(PERMISSIONS.SUPPLIER_MANAGE)
  createSupplier(@Tenant() t: TenantContext, @ZBody(supplierSchema) body: any) {
    return this.suppliers.create(t, body);
  }

  @Put('suppliers/:id')
  @RequirePermissions(PERMISSIONS.SUPPLIER_MANAGE)
  updateSupplier(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @ZBody(supplierSchema) body: any,
  ) {
    return this.suppliers.update(t, id, body);
  }

  @Delete('suppliers/:id')
  @RequirePermissions(PERMISSIONS.SUPPLIER_MANAGE)
  archiveSupplier(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.suppliers.archive(t, id);
  }

  @Post('suppliers/:id/payments')
  @RequirePermissions(PERMISSIONS.PURCHASE_MANAGE)
  paySupplier(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @ZBody(receivePaymentSchema) body: any,
  ) {
    return this.suppliers.pay(t, id, body);
  }
}
