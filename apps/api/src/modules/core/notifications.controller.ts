import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Tenant, TenantScoped } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@TenantScoped()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Tenant() t: TenantContext, @Query('unread') unread?: string) {
    return this.notifications.list(t.tenantId, t.userId, unread === 'true');
  }

  @Post('read-all')
  readAll(@Tenant() t: TenantContext) {
    return this.notifications.markRead(t.tenantId, t.userId);
  }

  @Post(':id/read')
  read(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.notifications.markRead(t.tenantId, t.userId, id);
  }
}
