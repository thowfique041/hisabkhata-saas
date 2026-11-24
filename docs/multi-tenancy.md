# Multi-tenancy

HisabKhata uses a **shared database, shared schema** model. Every business is a `Tenant`; every tenant-owned table has a non-null `tenantId` (or an optional one for `Notification`, `AuditLog` and `FileAsset`, which can also be platform-level).

## How the active tenant is resolved

1. On login, the API picks the user's first active membership (or the one the refresh token was issued for) and puts its id in the access token as `tid`.
2. `POST /api/auth/switch-tenant` verifies the user has an **active** membership in the target tenant and the tenant is not suspended, then issues new tokens.
3. On every tenant-scoped request `AccessGuard` loads `Membership(userId, tid)` with its role, user and tenant and rejects the request unless all are active. The tenant id is **never** read from the body, query string or headers.

Because the guard re-checks the database, disabling a member, removing them or suspending a tenant takes effect on the next request, even with an unexpired access token. Refresh tokens for that tenant are also revoked.

## Three layers of isolation

| Layer               | Where                                                          | What it does                                                                                                                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Context          | `AccessGuard`                                                  | Establishes `tenantCtx.tenantId` from the verified token and membership.                                                                                                                                                                                                       |
| 2. Explicit filters | Every service                                                  | Every query includes `tenantId` in its `where`; lookups by id use `findFirst({ where: { id, tenantId } })`; raw SQL always binds `tenantId`. Foreign keys supplied by clients (product, customer, supplier, category, image) are validated against the same tenant before use. |
| 3. Scoped client    | `PrismaService.scoped(tenantId)` (`tenant-scope.extension.ts`) | A Prisma client extension that injects `tenantId` into where-clauses of reads, updates and deletes, stamps it on creates, and throws `CrossTenantWriteError` if code tries to write a different tenant's id.                                                                   |

Unique constraints are scoped per tenant (`@@unique([tenantId, sku])`, `[tenantId, barcode]`, `[tenantId, invoiceNo]`, `[tenantId, name]` for categories and roles), so two shops can use the same SKU or invoice number.

## Files

Uploads are stored under a tenant folder (local disk in development, Cloudinary `authenticated` delivery in production). Files are never served from a public URL: `GET /api/files/:id/content` checks that the file belongs to the caller's active tenant before streaming it. A product can only reference images of its own tenant.

## Background jobs

Every job payload carries `tenantId`, and handlers re-load data with `where: { id, tenantId }`. Daily jobs iterate tenants explicitly.

## Super admin

Platform administration is a separate flag on `User` (`isSuperAdmin`), checked against the database on every `/api/admin/*` request. Tenant owners never receive it. The admin API exposes platform usage and subscription revenue; it does not expose tenants' sales amounts.

## Row-Level Security

PostgreSQL RLS was evaluated as a fourth layer. It needs a per-transaction `SET LOCAL app.tenant_id` on the same connection as every query. With Prisma's pooled connections (and Neon's PgBouncer pooler in transaction mode) that means wrapping every request in an interactive transaction, which adds a round trip per request and complicates long-running reports. Given the three layers above and the automated tests, RLS is left as a documented future hardening step. The schema is ready for it: every table has `tenantId`, so policies would be `USING ("tenantId" = current_setting('app.tenant_id'))`.

## Tests

`apps/api/test/tenancy.e2e-spec.ts` creates two tenants and checks that tenant B cannot list, read, update, archive, adjust, sell, refund, cancel, invoice, email, download, statement, switch into, or upload/attach files belonging to tenant A, that a `tenantId` in a request body is ignored, and that the scoping extension refuses cross-tenant writes.
