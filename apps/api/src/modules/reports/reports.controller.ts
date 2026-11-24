import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS, reportQuerySchema } from '@hisabkhata/shared';
import { RequirePermissions, Tenant, ZQuery } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { toCsv } from '../../common/utils/csv';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { renderReportPdf } from './report-pdf';
import { ReportsService, type Report } from './reports.service';

const BASIC = new Set(['sales', 'inventory', 'low-stock', 'expenses']);
const ADVANCED = new Set(['profit-loss', 'top-products', 'purchases', 'customers', 'payments']);

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get(':key')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  async get(@Tenant() t: TenantContext, @Param('key') key: string, @ZQuery(reportQuerySchema) q: any, @Res({ passthrough: true }) res: Response) {
    if (!BASIC.has(key) && !ADVANCED.has(key)) throw new BadRequestException('Unknown report');
    if (ADVANCED.has(key)) await this.subscriptions.assertFeature(t.tenantId, 'ADVANCED_REPORTS');

    let report: Report;
    switch (key) {
      case 'sales':
        report = await this.reports.sales(t.tenantId, q.from, q.to, q.period ?? 'daily');
        break;
      case 'profit-loss':
        report = await this.reports.profitLoss(t.tenantId, q.from, q.to);
        break;
      case 'inventory':
        report = await this.reports.inventory(t.tenantId);
        break;
      case 'low-stock':
        report = await this.reports.inventory(t.tenantId, true);
        break;
      case 'top-products':
        report = await this.reports.topProducts(t.tenantId, q.from, q.to);
        break;
      case 'purchases':
        report = await this.reports.purchases(t.tenantId, q.from, q.to);
        break;
      case 'customers':
        report = await this.reports.customers(t.tenantId, q.from, q.to);
        break;
      case 'expenses':
        report = await this.reports.expenses(t.tenantId, q.from, q.to);
        break;
      default:
        report = await this.reports.payments(t.tenantId, q.from, q.to);
    }

    const filename = `${report.key}-${new Date().toISOString().slice(0, 10)}`;
    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return toCsv(
        report.columns.map((c) => c.label),
        report.rows.map((r) => report.columns.map((c) => r[c.key] as string)),
      );
    }
    if (q.format === 'pdf') {
      const tenant = await this.reports.tenantTz(t.tenantId);
      const pdf = await renderReportPdf(report, tenant);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.end(pdf);
      return;
    }
    return report;
  }
}
