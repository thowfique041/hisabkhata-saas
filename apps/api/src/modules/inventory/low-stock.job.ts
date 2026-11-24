import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../core/notifications.service';
import { formatQty } from '@hisabkhata/shared';

/** Daily digest of products at or below their minimum stock, per tenant. */
@Injectable()
export class LowStockJob implements OnModuleInit {
  private readonly logger = new Logger(LowStockJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.jobs.register('inventory.low-stock-digest', () => this.run());
  }

  async run(onlyTenantId?: string) {
    const day = new Date().toISOString().slice(0, 10);
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE', ...(onlyTenantId ? { id: onlyTenantId } : {}) },
      select: { id: true, name: true, lowStockEmail: true },
    });
    let sent = 0;
    for (const t of tenants) {
      const items = await this.prisma.product.findMany({
        where: { tenantId: t.id, archivedAt: null, stock: { lte: this.prisma.product.fields.minStock }, minStock: { gt: 0 } },
        select: { name: true, sku: true, stock: true, minStock: true },
        orderBy: { stock: 'asc' },
        take: 50,
      });
      if (!items.length) continue;
      await this.notifications.notifyTenant(t.id, {
        type: 'low-stock',
        title: `${items.length} products are low on stock`,
        body: items.slice(0, 3).map((i) => i.name).join(', ') + (items.length > 3 ? ' and more' : ''),
        link: '/inventory?stock=low',
      });
      if (!t.lowStockEmail) continue;
      const owners = await this.prisma.membership.findMany({
        where: { tenantId: t.id, status: 'ACTIVE', role: { systemKey: { in: ['OWNER', 'MANAGER'] } } },
        include: { user: { select: { email: true } } },
      });
      for (const o of owners) {
        await this.mail.enqueue({
          template: 'low-stock',
          to: o.user.email,
          tenantId: t.id,
          dedupeKey: `low-stock:${t.id}:${o.userId}:${day}`,
          data: {
            businessName: t.name,
            items: items.map((i) => ({ name: i.name, sku: i.sku, stock: formatQty(i.stock.toString()), minStock: formatQty(i.minStock.toString()) })),
          },
        });
        sent++;
      }
    }
    this.logger.log(`Low-stock digest: ${sent} emails`);
    return { sent };
  }
}
