# Architecture

## Overview

HisabKhata is a pnpm monorepo with two deployable apps and one shared package.

| Part              | Responsibility                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/api`        | NestJS REST API. All business rules, authorization, money arithmetic, PDFs, email and jobs.                            |
| `apps/web`        | Next.js App Router frontend. Presentation, forms and client state only.                                                |
| `packages/shared` | Zod schemas, permission catalogue, enums, money/phone formatting. Imported by both apps so validation is written once. |

```
            ┌──────────────── Vercel ────────────────┐
Browser ───▶│ Next.js  (pages, /api/* rewrite)       │
            └───────────────┬────────────────────────┘
                            │ HTTPS (server-side proxy)
            ┌───────────────▼──────────── Render ────┐
            │ NestJS API                              │
            │  guards: Throttler → JWT → CSRF → Access│
            │  modules: auth, tenants, team, inventory│
            │   parties, purchases, sales, invoices,  │
            │   expenses, reports, subscriptions,     │
            │   files, mail, jobs, admin              │
            └──┬──────────┬───────────┬───────────┬───┘
               │          │           │           │
         Neon Postgres  Upstash   Cloudinary   SMTP (Brevo/Resend)
          (Prisma 7)    Redis      (private
                       (BullMQ)    images)
```

## Request lifecycle (API)

1. **ThrottlerGuard**: global limit 300 req/min per IP; auth endpoints 3 to 10/min.
2. **JwtAuthGuard** (Passport): verifies the HS256 access token from the `hk_at` cookie or `Authorization: Bearer`. `@Public()` routes skip it.
3. **CsrfGuard**: for unsafe methods authenticated by cookie, `X-CSRF-Token` must equal the `hk_csrf` cookie.
4. **AccessGuard**: for `@TenantScoped()` / `@RequirePermissions()` routes, loads the membership for `(user, tid)` and checks user, membership and tenant are active and the role holds every required permission. It attaches `req.tenantCtx`. For `@SuperAdminOnly()` routes it re-reads `isSuperAdmin` from the database.
5. **ZodPipe**: body and query validated with the shared schema (also published to Swagger).
6. Service runs, usually inside `prisma.$transaction`.
7. **AllExceptionsFilter** maps errors to `{ statusCode, error, message, details?, code?, requestId }`; unknown errors become a generic 500 and are logged with the request id.

## Core invariants

- **Stock** changes only through `StockService.move()`: a single conditional `UPDATE ... SET stock = stock + Δ WHERE ... AND (allowNegative OR stock + Δ >= 0) RETURNING stock`, followed by a `StockMovement` insert in the same transaction. Row-level locking inside the UPDATE makes concurrent sales safe. Products in a sale are moved in sorted id order to avoid deadlocks.
- **Money** is `Decimal(14,2)` in PostgreSQL, `Prisma.Decimal` (decimal.js, half-up) in the API, and decimal strings on the wire. The browser formats strings and previews cart totals with integer paisa arithmetic; it never computes authoritative totals.
- **Document numbers** (invoices, purchases, SKUs) come from `TenantCounter` via an atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` inside the business transaction: gap-free and per tenant.
- **Sales are idempotent**: an optional `idempotencyKey` is unique per tenant; a retried checkout returns the original sale.

## Background jobs

`JobsService` wraps BullMQ with three queues: `mail`, `documents` (invoice PDF + email) and `maintenance` (job schedulers for subscription expiry at 02:00 Dhaka and the low-stock digest at 09:00 Dhaka). Jobs retry 5 times with exponential backoff. Email delivery is idempotent through `EmailLog.dedupeKey`. With `QUEUES_ENABLED=false` jobs run inline, which the tests use.

## Frontend structure

- `(marketing)`: public pages, statically rendered.
- `(auth)`: login, register, password reset, verification.
- `(app)`: tenant application behind `TenantGate` (requires an active business) and per-page `RequirePermission`.
- `super-admin`: platform panel behind `SuperAdminGate`.
- `middleware.ts` redirects signed-out visitors away from private routes before render. It is a UX measure only; the API is the authority.
- Server state lives in TanStack Query; there is no global client store. `useList` handles pagination and filters, `useAction` wraps mutations with toasts and cache invalidation.

## Design system

Defined in `apps/web/src/app/globals.css` and `tailwind.config.ts`: navy primary, emerald for money in and positive figures, red for dues and negatives, amber for warnings, IBM Plex Sans with tabular figures, Hind Siliguri for Bangla. Tables use the `ledger` class (ruled rows, right-aligned money). See `docs/brand/README.md`.
