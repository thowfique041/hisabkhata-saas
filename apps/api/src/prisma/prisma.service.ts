import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { AppConfig } from '../config/app-config.service';
import { tenantScope } from './tenant-scope.extension';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL'), max: 10 }),
      transactionOptions: { maxWait: 5000, timeout: 15000 },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Returns a client that automatically constrains every query on tenant-owned models
   * to the given tenant. Services still pass tenantId explicitly; this is the safety net.
   */
  scoped(tenantId: string) {
    return this.$extends(tenantScope(tenantId));
  }
}

export type ScopedPrisma = ReturnType<PrismaService['scoped']>;
