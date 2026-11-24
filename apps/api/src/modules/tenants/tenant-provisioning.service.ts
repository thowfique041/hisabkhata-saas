import { Injectable } from '@nestjs/common';
import { DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLES, type BusinessType } from '@hisabkhata/shared';
import type { Prisma } from '../../generated/prisma/client';
import { randomToken, slugify } from '../../common/utils/crypto';

const DEFAULT_EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Maintenance', 'Marketing', 'Miscellaneous'];
const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: 'Full access to this business',
  MANAGER: 'Inventory, purchases, customers and sales',
  CASHIER: 'Point of sale, invoices and payments',
  STAFF: 'Read-only access to products and stock',
};

/** Creates a tenant with its built-in roles, default expense categories and a trial subscription. */
@Injectable()
export class TenantProvisioningService {
  async provision(
    tx: Prisma.TransactionClient,
    input: { name: string; businessType: BusinessType; ownerUserId: string; email?: string; phone?: string },
  ) {
    const slug = `${slugify(input.name)}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)}`;
    const tenant = await tx.tenant.create({
      data: { name: input.name, slug, businessType: input.businessType, email: input.email, phone: input.phone },
    });

    const roles: Record<string, string> = {};
    for (const key of SYSTEM_ROLES) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: key.charAt(0) + key.slice(1).toLowerCase(),
          systemKey: key,
          description: ROLE_DESCRIPTIONS[key],
          permissions: { create: DEFAULT_ROLE_PERMISSIONS[key].map((permissionKey) => ({ permissionKey })) },
        },
      });
      roles[key] = role.id;
    }

    await tx.membership.create({
      data: {
        tenantId: tenant.id,
        userId: input.ownerUserId,
        roleId: roles.OWNER,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });

    await tx.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ tenantId: tenant.id, name })),
    });

    // New businesses start on a Basic trial (if the plan offers one), then fall back to Free.
    const trialPlan = await tx.subscriptionPlan.findFirst({ where: { code: 'BASIC', isActive: true, trialDays: { gt: 0 } } });
    const freePlan = await tx.subscriptionPlan.findUnique({ where: { code: 'FREE' } });
    const now = new Date();
    if (trialPlan) {
      const trialEnd = new Date(now.getTime() + trialPlan.trialDays * 86_400_000);
      await tx.subscription.create({
        data: { tenantId: tenant.id, planId: trialPlan.id, status: 'TRIALING', startsAt: now, endsAt: trialEnd, trialEndsAt: trialEnd },
      });
    } else if (freePlan) {
      await tx.subscription.create({ data: { tenantId: tenant.id, planId: freePlan.id, status: 'ACTIVE', startsAt: now } });
    }

    return { tenant, roles };
  }
}
