import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

export interface AuditEntry {
  action: string;
  tenantId?: string | null;
  userId?: string | null;
  entity?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Audit writes must never break the business operation that triggered them. */
  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    try {
      await (tx ?? this.prisma).auditLog.create({
        data: {
          action: entry.action,
          tenantId: entry.tenantId ?? null,
          userId: entry.userId ?? null,
          entity: entry.entity,
          entityId: entry.entityId,
          metadata: entry.metadata,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      if (tx) throw err;
      this.logger.warn({ err, action: entry.action }, 'Failed to write audit log');
    }
  }
}
