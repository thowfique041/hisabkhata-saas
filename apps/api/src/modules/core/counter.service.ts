import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Gap-free, per-tenant document numbering (invoices, purchases).
 * Uses a single atomic UPSERT ... RETURNING inside the caller's transaction so two concurrent
 * sales never receive the same number, and a rolled-back sale does not consume one.
 */
@Injectable()
export class CounterService {
  async next(tx: Prisma.TransactionClient, tenantId: string, key: string): Promise<number> {
    const rows = await tx.$queryRaw<{ value: number }[]>`
      INSERT INTO "TenantCounter" ("tenantId", "key", "value")
      VALUES (${tenantId}, ${key}, 1)
      ON CONFLICT ("tenantId", "key") DO UPDATE SET "value" = "TenantCounter"."value" + 1
      RETURNING "value"`;
    return Number(rows[0].value);
  }

  format(prefix: string, n: number, date = new Date()): string {
    const yy = String(date.getUTCFullYear()).slice(-2);
    return `${prefix}-${yy}${String(n).padStart(5, '0')}`;
  }
}
