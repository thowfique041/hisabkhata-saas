import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CounterService } from './counter.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [AuditService, CounterService, NotificationsService],
  exports: [AuditService, CounterService, NotificationsService],
})
export class CoreModule {}
