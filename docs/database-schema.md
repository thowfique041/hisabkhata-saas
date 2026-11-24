# Database schema

Source of truth: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Migrations live in `apps/api/prisma/migrations`.

## Conventions

- Primary keys are CUIDs. Timestamps are stored in UTC (`createdAt`, `updatedAt`); the tenant's timezone is applied only when grouping and displaying.
- Money: `Decimal(14,2)`. Quantities: `Decimal(14,3)` (kg, litres). Rates: `Decimal(5,2)`.
- Every tenant-owned table has `tenantId` with `ON DELETE CASCADE` from `Tenant`, and an index that starts with `tenantId`.
- Soft deletion: `archivedAt` on products, categories, customers, suppliers and expense categories; `deletedAt` on expenses. Sales and purchases are never deleted; they are cancelled.
- Referential integrity: products used on a sale or purchase line cannot be hard-deleted (`ON DELETE RESTRICT`); suppliers with purchases likewise.

## Entities

### Identity and access

| Model                                          | Purpose                                                                                                         | Notable constraints                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `User`                                         | A person. `isSuperAdmin` for platform admins, `status`, lockout counters.                                       | `email` unique                                     |
| `Tenant`                                       | A business: profile, currency, timezone, invoice prefix and footer, default tax, negative-stock policy, status. | `slug` unique                                      |
| `Membership`                                   | User ↔ tenant with a role and status.                                                                           | `(userId, tenantId)` unique                        |
| `Role`                                         | Per-tenant role; `systemKey` marks built-ins.                                                                   | `(tenantId, name)`, `(tenantId, systemKey)` unique |
| `Permission`, `RolePermission`                 | Permission catalogue and role grants.                                                                           | composite PK                                       |
| `RefreshToken`                                 | Hashed refresh tokens with `familyId`, rotation link and revocation.                                            | `tokenHash` unique                                 |
| `EmailVerificationToken`, `PasswordResetToken` | Hashed single-use tokens with expiry.                                                                           | `tokenHash` unique                                 |

### Billing

| Model              | Purpose                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `SubscriptionPlan` | Code, prices (monthly, yearly), limits (`-1` = unlimited), trial days, feature flags.                                  |
| `Subscription`     | A tenant's plan over time. The live one has status `TRIALING`, `ACTIVE` or `PAST_DUE`; history is kept.                |
| `BillingPayment`   | A payment attempt with a provider reference. Activates a plan only when `SUCCEEDED`. `(provider, providerRef)` unique. |
| `WebhookEvent`     | Processed provider events; `(provider, eventId)` unique for idempotency.                                               |

### Inventory

| Model           | Purpose                                                                                                                    | Notable constraints                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Category`      | Product grouping.                                                                                                          | `(tenantId, name)` unique                                   |
| `Product`       | SKU, barcode, unit, purchase and selling price, tax rate, **current stock**, minimum stock, image.                         | `(tenantId, sku)`, `(tenantId, barcode)` unique             |
| `StockMovement` | Append-only ledger: type, signed quantity, balance after, unit cost, reference (sale, purchase, adjustment), reason, user. | Sum of `quantity` per product always equals `Product.stock` |

Movement types: `OPENING`, `PURCHASE`, `SALE`, `SALE_RETURN`, `SALE_CANCEL`, `PURCHASE_CANCEL`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`.

### Trading

| Model                        | Purpose                                                                                                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Customer`, `Supplier`       | Parties with contact details. Balances are computed from sales and purchases, not stored.                                                                                                                                                 |
| `Sale`                       | Invoice number, status, payment status, subtotal, item and order discount, tax rate and amount, total, paid, due, refunded, **cost of goods snapshot**, idempotency key. `(tenantId, invoiceNo)` and `(tenantId, idempotencyKey)` unique. |
| `SaleItem`                   | Product snapshot (name, SKU, unit), quantity, refunded quantity, unit price, **unit cost at time of sale**, line discount, line total.                                                                                                    |
| `Payment`                    | Money in or out: `direction`, `kind` (`SALE`, `SALE_DUE`, `SALE_REFUND`, `PURCHASE`, `PURCHASE_DUE`, `PURCHASE_REFUND`), method, amount, reference, linked sale/purchase/party.                                                           |
| `Invoice`                    | One per sale; tracks email delivery.                                                                                                                                                                                                      |
| `Purchase`, `PurchaseItem`   | Stock received from a supplier, with discount, transport cost, paid and due.                                                                                                                                                              |
| `ExpenseCategory`, `Expense` | Operating costs.                                                                                                                                                                                                                          |

### Platform

| Model           | Purpose                                                              |
| --------------- | -------------------------------------------------------------------- |
| `TenantCounter` | Atomic per-tenant sequences (`invoice`, `purchase`, `sku`).          |
| `Notification`  | In-app notices per tenant (or user).                                 |
| `AuditLog`      | Who did what, when, from which IP.                                   |
| `FileAsset`     | Uploaded images (provider, key, MIME type, size, owning tenant).     |
| `Announcement`  | Platform-wide notices from super admins.                             |
| `EmailLog`      | One row per logical email (`dedupeKey` unique) with delivery status. |

## Financial definitions

Used consistently in reports and the dashboard:

- **Gross sales** = sum of sale totals including tax, excluding cancelled sales.
- **Net revenue** = (total − tax) × (1 − refunded ÷ total), i.e. after discounts and returns, before tax.
- **Cost of goods sold** = sum of `Sale.costTotal`, which is captured at sale time from the product's purchase price and reduced by returns.
- **Gross profit** = net revenue − cost of goods sold.
- **Net profit** = gross profit − expenses.
