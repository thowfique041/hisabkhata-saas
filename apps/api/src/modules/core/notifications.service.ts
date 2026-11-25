import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from './alerts.service';

/** Live alerts carry data some roles may not see, so each type needs a permission to be listed. */
const TYPE_PERMISSION: Record<string, string> = {
  'low-stock': 'product.view',
  'out-of-stock': 'product.view',
  'customer-dues': 'customer.view',
  'supplier-dues': 'supplier.view',
  'trial-ending': 'subscription.manage',
};
function hiddenTypes(perms?: Set<string>) {
  if (!perms) return [];
  return Object.entries(TYPE_PERMISSION)
    .filter(([, p]) => !perms.has(p))
    .map(([t]) => t);
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async notifyTenant(
    tenantId: string,
    n: { type: string; title: string; body: string; link?: string },
  ) {
    return this.prisma.notification.create({ data: { tenantId, ...n } });
  }

  /** Tenant-wide notifications plus those addressed to this user. */
  async list(tenantId: string, userId: string, unreadOnly = false, perms?: Set<string>) {
    await this.alerts.refresh(tenantId);
    const hidden = hiddenTypes(perms);
    const where = {
      tenantId,
      OR: [{ userId: null }, { userId }],
      ...(hidden.length ? { type: { notIn: hidden } } : {}),
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
