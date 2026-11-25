import { Controller, Delete, ForbiddenException, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hisabkhata/shared';
import { RequirePermissions, Tenant } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { DemoService } from './demo.service';

/** Owners only: these actions write or delete a lot of data at once. */
function assertOwner(t: TenantContext) {
  if (t.roleKey !== 'OWNER')
    throw new ForbiddenException('Only the business owner can load or remove demo data');
}

@ApiTags('Demo data')
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  status(@Tenant() t: TenantContext) {
    return this.demo.status(t.tenantId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  load(@Tenant() t: TenantContext) {
    assertOwner(t);
    return this.demo.seed(t.tenantId, t.userId);
  }

  @Delete()
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  remove(@Tenant() t: TenantContext) {
    assertOwner(t);
    return this.demo.remove(t.tenantId, t.userId);
  }
}
