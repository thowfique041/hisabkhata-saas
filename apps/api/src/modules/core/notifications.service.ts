import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyTenant(tenantId: string, n: { type: string; title: string; body: string; link?: string }) {
    return this.prisma.notification.create({ data: { tenantId, ...n } });
  }

  /** Tenant-wide notifications plus those addressed to this user. */
  async list(tenantId: string, userId: string, unreadOnly = false) {
    const where = {
      tenantId,
      OR: [{ userId: null }, { userId }],
      ...(unreadOnly ? { readAt: null } : {}),
    };
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(tenantId: string, userId: string, id?: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, OR: [{ userId: null }, { userId }], readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
