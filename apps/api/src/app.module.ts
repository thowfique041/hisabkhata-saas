import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { validateEnv } from './config/env';
import { AppConfig } from './config/app-config.service';
import { PrismaModule } from './prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { AccessGuard } from './common/guards/access.guard';
import { CoreModule } from './modules/core/core.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MailModule } from './modules/mail/mail.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TeamModule } from './modules/team/team.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PartiesModule } from './modules/parties/parties.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { SalesModule } from './modules/sales/sales.module';
import { FilesModule } from './modules/files/files.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AdminModule } from './modules/admin/admin.module';
import { DemoModule } from './modules/demo/demo.module';
import { MiscController } from './modules/misc/misc.controller';

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
class AppConfigModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    AppConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.LOG_LEVEL ??
          (process.env.NODE_ENV === 'test'
            ? 'silent'
            : process.env.NODE_ENV === 'production'
              ? 'info'
              : 'debug'),
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string) || randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            '*.password',
            '*.passwordHash',
            '*.token',
          ],
          censor: '[redacted]',
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        customProps: (req: any) => ({ userId: req.user?.id, tenantId: req.tenantCtx?.tenantId }),
        autoLogging: { ignore: (req) => req.url === '/api/health' },
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
      // Integration tests hammer auth endpoints from one IP; rate limiting has its own test.
      skipIf: () => process.env.NODE_ENV === 'test' && process.env.THROTTLE_IN_TESTS !== '1',
    }),
    PrismaModule,
    CoreModule,
    JobsModule,
    MailModule,
    SubscriptionsModule,
    FilesModule,
    AuthModule,
    TenantsModule,
    TeamModule,
    InventoryModule,
    PartiesModule,
    PurchasesModule,
    SalesModule,
    InvoicesModule,
    ExpensesModule,
    ReportsModule,
    AdminModule,
    DemoModule,
  ],
  controllers: [MiscController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule {}
