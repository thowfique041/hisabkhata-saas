import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hisabkhata/shared';
import { RequirePermissions, Tenant } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  overview(@Tenant() t: TenantContext) {
    return this.dashboard.overview(t.tenantId);
  }
}

@Module({
  controllers: [ReportsController, DashboardController],
  providers: [ReportsService, DashboardService],
})
export class ReportsModule {}
