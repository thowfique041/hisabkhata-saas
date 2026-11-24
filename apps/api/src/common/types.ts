import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  /** Active tenant id from the access token. Always re-validated against Membership. */
  tid: string | null;
}

export interface TenantContext {
  tenantId: string;
  userId: string;
  membershipId: string;
  roleId: string;
  roleKey: string | null;
  permissions: Set<string>;
  tenant: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    allowNegativeStock: boolean;
    defaultTaxRate: string;
    invoicePrefix: string;
  };
}

export interface AppRequest extends Request {
  user?: AuthUser;
  tenantCtx?: TenantContext;
}
