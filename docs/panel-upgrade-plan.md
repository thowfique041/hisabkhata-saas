# Panel upgrade plan

## What exists today

- **Web (`apps/web`):**
  - Next.js 15 App Router. Panel routes live under `src/app/(app)/*`, wrapped by `TenantGate` and `AppShell` (`components/shell/app-shell.tsx`: sidebar, top bar, breadcrumbs, quick search, bell, account menu, verify banner, announcements).
  - UI: Tailwind 3 with a small local kit in `components/ui` (Button, Input, Dialog/Sheet, dropdown Menu, Badge, Tabs, Switch, Checkbox). Radix primitives, Lucide icons, Recharts (`components/charts.tsx`), sonner toasts.
  - Data: TanStack Query through `useApi` / `useList` / `useAction` (`hooks/use-api.ts`). Forms use React Hook Form with zod schemas from `@hisabkhata/shared`.
  - Session and permissions: `useSession` / `useCan`.
  - Marketing i18n (cookie `hk_lang`, typed dictionaries in `lib/i18n`) and `next-themes` dark mode already exist and will be reused.
- **API (`apps/api`):**
  - NestJS modules: inventory (products, categories, stock), sales, invoices (PDFKit), parties (customers, suppliers), purchases, expenses, reports (dashboard, reports, PDF/CSV), team (employees, roles), subscriptions, core (audit, counters, notifications).
  - Every request is tenant-scoped by `AccessGuard` and the Prisma tenant extension. Permissions use `@RequirePermissions`.
  - `Notification` model and `GET /notifications` exist, but they are only fed by background jobs that do not run on the free deployment (queues off).
- **Tests:** Jest e2e with Supertest against a real Postgres (`apps/api/test/*.e2e-spec.ts`). The tenancy suite checks cross-tenant isolation.

## Decisions

- **Held bills:** stored in `localStorage`, keyed by business and device (`hk_held:<tenantId>`). There is no backend model. Held bills are a counter convenience, they never touch stock, and they must survive a flaky connection. The report flags this for review.
- **Demo data:**
  - An `isDemo` flag (migration) on Category, Product, Customer, Supplier, Sale, Purchase, Expense, ExpenseCategory and Payment.
  - Demo sales and purchases use a `DEMO-` number prefix, so they never consume the business's real invoice or purchase counters.
  - Removal deletes only flagged rows. A demo product or customer that a real (non-demo) record now references is kept rather than breaking history, and the summary says so.
  - Both actions are owner only (`settings.manage` plus an owner check).
- **Product import:**
  - The browser parses CSV (papaparse) or Excel (read-excel-file) into rows.
  - `POST /products/import` with `{ rows, dryRun }` validates every row server-side. It returns per-row errors and creates missing categories, products and opening stock in one transaction.
  - Requires `product.manage`.
- **Notifications:**
  - Add `dedupeKey` to Notification (unique per tenant, migration).
  - Add an `AlertsService` that derives alerts from live data on read, at most once per 10 minutes per business: low stock, out of stock, customer dues older than 30 days, supplier dues, trial ending in 7, 3 or 1 days.
  - It works without a job runner.
- **Language per user:** a `locale` column on User (migration), set through `PATCH /auth/me/preferences`. Choosing a language also sets the `hk_lang` cookie, so the marketing site and panel agree.
- **Fonts:** move IBM Plex Sans and Hind Siliguri to `next/font/local`, loading the woff2 files shipped by `@fontsource` (no network at build).

## Phases and main files

1. **POS:** `app/(app)/pos/*` split into components:
   - layout, cart panel, mobile cart sheet;
   - full-screen toggle (shell reads a `pos-fullscreen` flag);
   - cash quick amounts, held bills (`lib/held-bills.ts`), shortcuts popover, customer quick-add form, success dialog.
   - Button disabled styles and tooltip in `components/ui/button.tsx`.
2. **Onboarding:**
   - Chart empty state in `components/charts.tsx`.
   - API: `modules/demo/*` (seed and remove, plus tests), `POST /products/import` (plus tests).
   - Web: import wizard on Products, demo actions on the dashboard checklist and empty Products page, dismissible verify banner.
3. **Navigation:**
   - `components/shell/command-palette.tsx` (cmdk), collapsible sidebar, trial badge.
   - `modules/core/alerts.service.ts` (plus tests).
   - `components/date-range-picker.tsx` used on Sales, Expenses and Reports.
4. **Pages:**
   - Dashboard: comparisons and sparklines. This extends the `/dashboard` response with previous-period values and a daily series; no breaking change.
   - Report charts, subscription button hierarchy.
   - Settings: unsaved bar and live invoice preview.
   - Roles: permission matrix. Stock adjustments: default filter. Tables: shared `SortableTh`, sticky header, hover.
5. **Language and theme:**
   - Panel dictionaries (`lib/i18n/panel-*.ts`) covering the shell, POS, dashboard and every list page's headings, actions, empty states and toasts.
   - Language and theme in the account menu. Invoices stay light.
6. **Responsive:**
   - Drawer sidebar below 1024px, horizontal table scroll, single-column forms.
   - A `coarse` (touch) Tailwind variant raises tap targets to 44px.

New dependencies: `cmdk`, `papaparse`, `read-excel-file`. Migrations: one for demo flags, notification dedupe and user locale.
