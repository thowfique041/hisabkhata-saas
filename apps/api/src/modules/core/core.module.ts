import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CounterService } from './counter.service';
import { AlertsService } from './alerts.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [AuditService, CounterService, NotificationsService, AlertsService],
  exports: [AuditService, CounterService, NotificationsService, AlertsService],
})
export class CoreModule {}
