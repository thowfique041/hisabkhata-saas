/**
 * Seed: permissions catalogue, subscription plans, platform super admin, and (optionally)
 * realistic Bangladeshi demo businesses. Demo data is created through the real services so
 * stock movements, invoice numbers and payments are all consistent.
 *
 *   pnpm --filter @hisabkhata/api seed
 *
 * Idempotent: safe to run repeatedly.
 */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSIONS } from '@hisabkhata/shared';

process.env.QUEUES_ENABLED = 'false';
process.env.SMTP_HOST = '';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'warn';

const PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'For a single shop getting started.',
    priceMonthly: '0',
    priceYearly: '0',
    maxProducts: 50,
    maxEmployees: 1,
    trialDays: 0,
    features: [] as string[],
    sortOrder: 1,
  },
  {
    code: 'BASIC',
    name: 'Basic',
    description: 'For growing shops with a small team.',
    priceMonthly: '499',
    priceYearly: '4990',
    maxProducts: 500,
    maxEmployees: 5,
    trialDays: 14,
    features: ['ADVANCED_REPORTS', 'INVOICE_EMAIL'],
    sortOrder: 2,
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    description: 'For wholesalers, distributors and multi-counter stores.',
    priceMonthly: '1499',
    priceYearly: '14990',
    maxProducts: -1,
    maxEmployees: -1,
    trialDays: 0,
    features: ['ADVANCED_REPORTS', 'ADVANCED_ANALYTICS', 'PRIORITY_SUPPORT', 'INVOICE_EMAIL'],
    sortOrder: 3,
  },
];

async function main() {
  const { AppModule } = await import('../src/app.module');
  const { PrismaService } = await import('../src/prisma/prisma.service');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);

  // ---- permissions
  const groupOf = new Map<string, string>();
  for (const g of PERMISSION_GROUPS) for (const p of g.permissions) groupOf.set(p, g.label);
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, create: { key, group: groupOf.get(key) }, update: { group: groupOf.get(key) } });
  }
  // Existing owner roles always receive newly added permissions.
  const owners = await prisma.role.findMany({ where: { systemKey: 'OWNER' }, select: { id: true } });
  for (const r of owners) {
    await prisma.rolePermission.createMany({ data: ALL_PERMISSIONS.map((permissionKey) => ({ roleId: r.id, permissionKey })), skipDuplicates: true });
  }

  // ---- plans
  for (const p of PLANS) {
    await prisma.subscriptionPlan.upsert({ where: { code: p.code }, create: p, update: { name: p.name, description: p.description, features: p.features, sortOrder: p.sortOrder } });
  }

  // ---- super admin
  const { AuthService } = await import('../src/modules/auth/auth.service');
  const auth = app.get(AuthService);
  const adminEmail = (process.env.SEED_SUPERADMIN_EMAIL ?? 'admin@hisabkhata.local').toLowerCase();
  const adminPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? 'Admin12345';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: { email: adminEmail, name: 'Platform Admin', passwordHash: await auth.hashPassword(adminPassword), isSuperAdmin: true, emailVerifiedAt: new Date() },
    });
    console.log(`Super admin created: ${adminEmail}`);
  } else if (!existingAdmin.isSuperAdmin) {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: { isSuperAdmin: true } });
  }

  if (process.env.SEED_DEMO_DATA !== 'false') {
    const { seedDemo } = await import('./seed-demo');
    await seedDemo(app);
  }

  await app.close();
  console.log('Seed complete.');
}

void PERMISSIONS;
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
