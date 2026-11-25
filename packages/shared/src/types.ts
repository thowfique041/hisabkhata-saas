import type { Permission } from './permissions';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: { path: string; message: string }[];
  requestId?: string;
}

export interface SessionTenant {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isSuperAdmin: boolean;
  avatarUrl: string | null;
}

export interface SessionPayload {
  user: SessionUser;
  activeTenant:
    | (SessionTenant & {
        currency: string;
        timezone: string;
        logoUrl: string | null;
        /** Built-in role key (OWNER, MANAGER, CASHIER, STAFF) or null for custom roles. */ roleKey?:
          string | null;
      })
    | null;
  tenants: SessionTenant[];
  permissions: Permission[];
  plan: {
    code: string;
    name: string;
    status: string;
    endsAt: string | null;
    features: string[];
  } | null;
}
