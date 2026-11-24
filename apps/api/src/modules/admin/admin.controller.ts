import { BadRequestException, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { announcementSchema, listQuerySchema, planSchema, tenantStatusSchema } from '@hisabkhata/shared';
import { CurrentUser, SuperAdminOnly, ZBody, ZQuery } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { AppConfig } from '../../config/app-config.service';
import { JobsService, QUEUES, type QueueName } from '../jobs/jobs.service';
import { PaymentProviderRegistry } from '../subscriptions/providers/provider.registry';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { LowStockJob } from '../inventory/low-stock.job';
import { AdminService } from './admin.service';

const statusQuery = listQuerySchema.extend({ status: z.string().optional(), tenantId: z.string().optional() });

@ApiTags('Platform admin')
@Controller('admin')
@SuperAdminOnly()
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly jobs: JobsService,
    private readonly config: AppConfig,
    private readonly providers: PaymentProviderRegistry,
    private readonly subscriptions: SubscriptionsService,
    private readonly lowStock: LowStockJob,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('analytics')
  analytics() {
    return this.admin.analytics();
  }

  @Get('tenants')
  tenants(@ZQuery(statusQuery) q: any) {
    return this.admin.tenants(q);
  }

  @Get('tenants/:id')
  tenant(@Param('id') id: string) {
    return this.admin.tenant(id);
  }

  @Patch('tenants/:id/status')
  tenantStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @ZBody(tenantStatusSchema) body: any) {
    return this.admin.setTenantStatus(u.id, id, body.status, body.reason);
  }

  @Get('users')
  users(@ZQuery(listQuerySchema) q: any) {
    return this.admin.users(q);
  }

  @Patch('users/:id/status')
  userStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @ZBody(z.object({ status: z.enum(['ACTIVE', 'DISABLED']) })) body: any) {
    return this.admin.setUserStatus(u.id, id, body.status);
  }

  @Get('plans')
  plans() {
    return this.admin.plans();
  }

  @Post('plans')
  createPlan(@CurrentUser() u: AuthUser, @ZBody(planSchema) body: any) {
    return this.admin.createPlan(u.id, body);
  }

  @Put('plans/:id')
  updatePlan(@CurrentUser() u: AuthUser, @Param('id') id: string, @ZBody(planSchema) body: any) {
    return this.admin.updatePlan(u.id, id, body);
  }

  @Get('subscriptions')
  subscriptionsList(@ZQuery(statusQuery) q: any) {
    return this.admin.subscriptionList(q);
  }

  @Get('billing-payments')
  billingPayments(@ZQuery(statusQuery) q: any) {
    return this.admin.billingPayments(q);
  }

  @Post('billing-payments/:id/confirm')
  confirm(@CurrentUser() u: AuthUser, @Param('id') id: string, @ZBody(z.object({ reference: z.string().max(80).optional() })) body: any) {
    return this.admin.confirmManualPayment(u.id, id, body.reference);
  }

  @Get('audit-logs')
  audit(@ZQuery(statusQuery) q: any) {
    return this.admin.auditLogs(q);
  }

  @Get('email-logs')
  emails(@ZQuery(statusQuery) q: any) {
    return this.admin.emailLogs(q);
  }

  @Get('jobs')
  jobStats() {
    return this.jobs.stats();
  }

  @Post('jobs/:queue/:id/retry')
  retry(@Param('queue') queue: string, @Param('id') id: string) {
    if (!QUEUES.includes(queue as QueueName)) throw new BadRequestException('Unknown queue');
    return this.jobs.retry(queue as QueueName, id);
  }

  @Post('jobs/run/:name')
  async run(@Param('name') name: string) {
    if (name === 'subscription-expiry') return this.subscriptions.runExpiryCheck();
    if (name === 'low-stock-digest') return this.lowStock.run();
    throw new BadRequestException('Unknown job');
  }

  @Get('announcements')
  announcements() {
    return this.admin.announcements();
  }

  @Post('announcements')
  createAnnouncement(@CurrentUser() u: AuthUser, @ZBody(announcementSchema) body: any) {
    return this.admin.createAnnouncement(u.id, body);
  }

  @Put('announcements/:id')
  updateAnnouncement(@Param('id') id: string, @ZBody(announcementSchema) body: any) {
    return this.admin.updateAnnouncement(id, body);
  }

  @Delete('announcements/:id')
  deleteAnnouncement(@Param('id') id: string) {
    return this.admin.deleteAnnouncement(id);
  }

  /** Non-secret runtime configuration, for the platform settings page. */
  @Get('system')
  async system() {
    return {
      environment: this.config.get('NODE_ENV'),
      storageDriver: this.config.get('STORAGE_DRIVER'),
      queuesEnabled: this.jobs.enabled,
      redisReachable: await this.jobs.ping(),
      smtpConfigured: Boolean(this.config.get('SMTP_HOST')),
      mailFrom: this.config.get('MAIL_FROM'),
      paymentProviders: this.providers.available(),
      appUrl: this.config.get('APP_URL'),
      apiUrl: this.config.get('API_URL'),
      corsOrigins: this.config.corsOrigins,
    };
  }
}
