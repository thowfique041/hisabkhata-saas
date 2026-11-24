# Development guide

## Daily workflow

```bash
docker compose up -d postgres redis mailpit
pnpm dev               # API (watch) on :4000, web on :3000
pnpm test              # API unit + integration tests
pnpm lint && pnpm typecheck
```

Mailpit inbox: http://localhost:8025. Swagger: http://localhost:4000/api/docs.

## Adding a feature (checklist)

1. **Schema**: edit `apps/api/prisma/schema.prisma`. Tenant-owned model? Add `tenantId`, a relation to `Tenant` with `onDelete: Cascade`, an index starting with `tenantId`, and scope unique constraints with `tenantId`. Add the model name to `TENANT_MODELS` in `src/prisma/tenant-scope.extension.ts`. Run `pnpm --filter @hisabkhata/api prisma:migrate --name <change>`.
2. **Validation**: add the Zod schema to `packages/shared/src/schemas.ts` so API and web share it.
3. **Permission**: add it to `packages/shared/src/permissions.ts`, to the default roles if appropriate, and rerun the seed (owners automatically receive new permissions).
4. **API**: service methods take a `TenantContext` and always filter by `ctx.tenantId`. Controllers use `@RequirePermissions(...)`, `@ZBody(schema)`, `@ZQuery(schema)` and `@Tenant()`. Money: use helpers in `common/utils/decimal.ts`, never `Number()` arithmetic. Stock: only via `StockService.move()` inside a transaction. Log meaningful actions with `AuditService`.
5. **Tests**: add integration tests in `apps/api/test`, including a cross-tenant attempt.
6. **Web**: a page under `src/app/(app)/<route>/page.tsx` wrapped in `RequirePermission`; fetch with `useApi` / `useList`, mutate with `useAction`; forms with React Hook Form + `zodResolver(sharedSchema)`; add the route to `components/shell/nav.ts` and `middleware.ts`.

## Code conventions

- Strict TypeScript everywhere. Money and quantities cross the wire as strings.
- User-facing copy: sentence case, plain verbs, the action's name stays the same from button to toast ("Record purchase" → "Purchase saved").
- Destructive actions always go through `useConfirm()`.
- Every list has loading, empty and error states (`TableSkeleton`, `EmptyState`, `ErrorState`).
- Use the `ledger` table class and `<Money>` for amounts so alignment and colour stay consistent.

## Useful scripts

| Script                                                         | Purpose                                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/api/scripts/reset-db.sh`                                 | Drop, migrate and reseed the local database (refuses non-local URLs).                                 |
| `node apps/api/scripts/prisma-wasm.mjs diff <name>` / `deploy` | Create/apply migrations with Prisma's WebAssembly engine when the native engine cannot be downloaded. |
| `pnpm --filter @hisabkhata/api seed`                           | Idempotent seed. `SEED_DEMO_DATA=false` skips the demo businesses.                                    |

## Git hooks

`pnpm install` installs Husky; the pre-commit hook runs Prettier on staged files through lint-staged.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: API lint, typecheck, the full test suite against a PostgreSQL service container, API build; web lint, typecheck and production build.
