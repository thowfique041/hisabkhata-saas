import { Controller, ForbiddenException, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createTenantSchema, PERMISSIONS, tenantSettingsSchema, type TenantSettingsInput } from '@hisabkhata/shared';
import { ClientMeta, CurrentUser, RequirePermissions, Tenant, TenantScoped, ZBody, type ClientMetaInfo } from '../../common/decorators';
import type { AuthUser, TenantContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { TenantProvisioningService } from './tenant-provisioning.service';

@ApiTags('Business')
@Controller()
export class TenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: TenantProvisioningService,
    private readonly audit: AuditService,
  ) {}

  /** Lets an existing user open an additional business. They become its owner. */
  @Post('tenants')
  async create(@CurrentUser() user: AuthUser, @ZBody(createTenantSchema) body: any, @ClientMeta() meta: ClientMetaInfo) {
    const owned = await this.prisma.membership.count({ where: { userId: user.id, role: { systemKey: 'OWNER' } } });
    if (owned >= 5 && !user.isSuperAdmin) {
      throw new ForbiddenException('You can own up to 5 businesses. Contact support for more.');
    }
    const { tenant } = await this.prisma.$transaction((tx) =>
      this.provisioning.provision(tx, { name: body.name, businessType: body.businessType, ownerUserId: user.id }),
    );
    await this.audit.log({ action: 'tenant.created', userId: user.id, tenantId: tenant.id, ...meta });
    return { id: tenant.id, name: tenant.name, slug: tenant.slug };
  }

  @Get('tenant/settings')
  @TenantScoped()
  async settings(@Tenant() t: TenantContext) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: t.tenantId } });
  }

  @Put('tenant/settings')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async update(@Tenant() t: TenantContext, @ZBody(tenantSettingsSchema) body: TenantSettingsInput, @ClientMeta() meta: ClientMetaInfo) {
    const tenant = await this.prisma.tenant.update({
      where: { id: t.tenantId },
      data: {
        name: body.name,
        businessType: body.businessType,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        taxId: body.taxId ?? null,
        currency: body.currency,
        timezone: body.timezone,
        invoicePrefix: body.invoicePrefix,
        invoiceFooter: body.invoiceFooter ?? null,
        defaultTaxRate: body.defaultTaxRate,
        allowNegativeStock: body.allowNegativeStock,
        lowStockEmail: body.lowStockEmail,
      },
    });
    await this.audit.log({ action: 'tenant.settings_updated', tenantId: t.tenantId, userId: t.userId, ...meta });
    return tenant;
  }
}
