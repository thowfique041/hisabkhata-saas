import { Prisma } from '../generated/prisma/client';

/** Models whose rows belong to exactly one tenant. */
export const TENANT_MODELS = new Set<string>([
  'Role',
  'Membership',
  'Category',
  'Product',
  'StockMovement',
  'Customer',
  'Supplier',
  'Sale',
  'SaleItem',
  'Payment',
  'Purchase',
  'PurchaseItem',
  'ExpenseCategory',
  'Expense',
  'Invoice',
  'TenantCounter',
  'Subscription',
  'BillingPayment',
  'Notification',
  'AuditLog',
  'FileAsset',
]);

const WHERE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

export class CrossTenantWriteError extends Error {
  constructor(model: string) {
    super(`Refusing to write ${model} for a different tenant`);
  }
}

function stampData(model: string, data: Record<string, unknown>, tenantId: string) {
  if (data.tenantId !== undefined && data.tenantId !== tenantId) throw new CrossTenantWriteError(model);
  return { ...data, tenantId };
}

/**
 * Prisma client extension that injects `tenantId` into every where-clause and create payload
 * for tenant-owned models. It is a defence-in-depth layer: services also filter explicitly.
 */
export function tenantScope(tenantId: string) {
  return Prisma.defineExtension({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) return query(args);
          const a = (args ?? {}) as Record<string, any>;

          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), tenantId };
          }
          if (operation === 'create') {
            a.data = stampData(model, a.data ?? {}, tenantId);
          }
          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            a.data = rows.map((r: Record<string, unknown>) => stampData(model, r, tenantId));
          }
          if (operation === 'upsert') {
            a.create = stampData(model, a.create ?? {}, tenantId);
          }
          if ((operation === 'update' || operation === 'updateMany') && a.data?.tenantId && a.data.tenantId !== tenantId) {
            throw new CrossTenantWriteError(model);
          }
          return query(a);
        },
      },
    },
  });
}
