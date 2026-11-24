# API documentation

Interactive documentation (Swagger UI) runs at `/api/docs`, and the OpenAPI JSON at `/api/docs-json`. Request bodies and query parameters are generated from the same Zod schemas the API validates with.

## Conventions

- Base path: `/api`. JSON in and out; money and quantities are **decimal strings** (`"1250.50"`).
- Lists accept `page`, `pageSize` (max 100), `search`, `sort`, `order` and return `{ items, total, page, pageSize, pageCount }`.
- Errors: `{ statusCode, error, message, details?: [{ path, message }], code?, requestId }`. Codes include `INSUFFICIENT_STOCK`, `PLAN_LIMIT`, `PLAN_FEATURE`, `TENANT_SUSPENDED`, `NOT_MEMBER`, `NO_TENANT`.
- Auth: cookie session from `/api/auth/login` (send `X-CSRF-Token` on writes) or `Authorization: Bearer <token>` from `/api/auth/token`.
- Tenant-scoped endpoints act on the business in the session; there is no tenant id in URLs.

## Endpoints

### Account & platform

| Method | Path                  | Access                 | Notes |
| ------ | --------------------- | ---------------------- | ----- |
| GET    | `/api/announcements`  | signed in              |       |
| GET    | `/api/audit-logs`     | permission: audit.view |       |
| GET    | `/api/health`         | public                 |       |
| GET    | `/api/profile`        | signed in              |       |
| PUT    | `/api/profile`        | signed in              |       |
| POST   | `/api/public/contact` | public                 |       |

### Auth

| Method | Path                            | Access    | Notes                                                        |
| ------ | ------------------------------- | --------- | ------------------------------------------------------------ |
| POST   | `/api/auth/change-password`     | signed in |                                                              |
| POST   | `/api/auth/forgot-password`     | public    |                                                              |
| POST   | `/api/auth/login`               | public    |                                                              |
| POST   | `/api/auth/logout`              | public    |                                                              |
| POST   | `/api/auth/refresh`             | public    |                                                              |
| POST   | `/api/auth/register`            | public    | Create an account and a new business (tenant)                |
| POST   | `/api/auth/resend-verification` | signed in |                                                              |
| POST   | `/api/auth/reset-password`      | public    |                                                              |
| GET    | `/api/auth/session`             | signed in |                                                              |
| POST   | `/api/auth/switch-tenant`       | signed in |                                                              |
| POST   | `/api/auth/token`               | public    | Bearer access token for API clients and Swagger (no cookies) |
| POST   | `/api/auth/verify-email`        | public    |                                                              |

### Business

| Method | Path                   | Access                      | Notes |
| ------ | ---------------------- | --------------------------- | ----- |
| GET    | `/api/tenant/settings` | signed in                   |       |
| PUT    | `/api/tenant/settings` | permission: settings.manage |       |
| POST   | `/api/tenants`         | signed in                   |       |

### Customers & Suppliers

| Method | Path                            | Access                      | Notes |
| ------ | ------------------------------- | --------------------------- | ----- |
| GET    | `/api/customers`                | permission: customer.view   |       |
| POST   | `/api/customers`                | permission: customer.manage |       |
| DELETE | `/api/customers/{id}`           | permission: customer.manage |       |
| GET    | `/api/customers/{id}`           | permission: customer.view   |       |
| PUT    | `/api/customers/{id}`           | permission: customer.manage |       |
| POST   | `/api/customers/{id}/payments`  | permission: payment.receive |       |
| GET    | `/api/customers/{id}/statement` | permission: customer.view   |       |
| GET    | `/api/suppliers`                | permission: supplier.view   |       |
| POST   | `/api/suppliers`                | permission: supplier.manage |       |
| DELETE | `/api/suppliers/{id}`           | permission: supplier.manage |       |
| GET    | `/api/suppliers/{id}`           | permission: supplier.view   |       |
| PUT    | `/api/suppliers/{id}`           | permission: supplier.manage |       |
| POST   | `/api/suppliers/{id}/payments`  | permission: purchase.manage |       |

### Dashboard

| Method | Path             | Access                     | Notes |
| ------ | ---------------- | -------------------------- | ----- |
| GET    | `/api/dashboard` | permission: dashboard.view |       |

### Expenses

| Method | Path                           | Access                     | Notes |
| ------ | ------------------------------ | -------------------------- | ----- |
| GET    | `/api/expense-categories`      | permission: expense.view   |       |
| POST   | `/api/expense-categories`      | permission: expense.manage |       |
| DELETE | `/api/expense-categories/{id}` | permission: expense.manage |       |
| PUT    | `/api/expense-categories/{id}` | permission: expense.manage |       |
| GET    | `/api/expenses`                | permission: expense.view   |       |
| POST   | `/api/expenses`                | permission: expense.manage |       |
| DELETE | `/api/expenses/{id}`           | permission: expense.manage |       |
| PUT    | `/api/expenses/{id}`           | permission: expense.manage |       |

### Files

| Method | Path                      | Access    | Notes |
| ------ | ------------------------- | --------- | ----- |
| POST   | `/api/files`              | signed in |       |
| POST   | `/api/files/avatar`       | signed in |       |
| GET    | `/api/files/{id}/content` | signed in |       |

### Inventory

| Method | Path                         | Access                      | Notes |
| ------ | ---------------------------- | --------------------------- | ----- |
| GET    | `/api/categories`            | permission: product.view    |       |
| POST   | `/api/categories`            | permission: category.manage |       |
| DELETE | `/api/categories/{id}`       | permission: category.manage |       |
| PUT    | `/api/categories/{id}`       | permission: category.manage |       |
| POST   | `/api/inventory/adjustments` | permission: stock.adjust    |       |
| GET    | `/api/inventory/low-stock`   | permission: stock.view      |       |
| GET    | `/api/inventory/movements`   | permission: stock.view      |       |
| GET    | `/api/products`              | permission: product.view    |       |
| POST   | `/api/products`              | permission: product.manage  |       |
| POST   | `/api/products/bulk`         | permission: product.manage  |       |
| GET    | `/api/products/lookup`       | permission: product.view    |       |
| DELETE | `/api/products/{id}`         | permission: product.manage  |       |
| GET    | `/api/products/{id}`         | permission: product.view    |       |
| PATCH  | `/api/products/{id}`         | permission: product.manage  |       |
| POST   | `/api/products/{id}/restore` | permission: product.manage  |       |

### Invoices

| Method | Path                           | Access                   | Notes |
| ------ | ------------------------------ | ------------------------ | ----- |
| GET    | `/api/invoices`                | permission: invoice.view |       |
| POST   | `/api/invoices/{saleId}/email` | permission: invoice.send |       |
| GET    | `/api/invoices/{saleId}/pdf`   | permission: invoice.view |       |

### Notifications

| Method | Path                           | Access    | Notes |
| ------ | ------------------------------ | --------- | ----- |
| GET    | `/api/notifications`           | signed in |       |
| POST   | `/api/notifications/read-all`  | signed in |       |
| POST   | `/api/notifications/{id}/read` | signed in |       |

### Platform admin

| Method | Path                                       | Access               | Notes |
| ------ | ------------------------------------------ | -------------------- | ----- |
| GET    | `/api/admin/analytics`                     | platform super admin |       |
| GET    | `/api/admin/announcements`                 | platform super admin |       |
| POST   | `/api/admin/announcements`                 | platform super admin |       |
| DELETE | `/api/admin/announcements/{id}`            | platform super admin |       |
| PUT    | `/api/admin/announcements/{id}`            | platform super admin |       |
| GET    | `/api/admin/audit-logs`                    | platform super admin |       |
| GET    | `/api/admin/billing-payments`              | platform super admin |       |
| POST   | `/api/admin/billing-payments/{id}/confirm` | platform super admin |       |
| GET    | `/api/admin/email-logs`                    | platform super admin |       |
| GET    | `/api/admin/jobs`                          | platform super admin |       |
| POST   | `/api/admin/jobs/run/{name}`               | platform super admin |       |
| POST   | `/api/admin/jobs/{queue}/{id}/retry`       | platform super admin |       |
| GET    | `/api/admin/overview`                      | platform super admin |       |
| GET    | `/api/admin/plans`                         | platform super admin |       |
| POST   | `/api/admin/plans`                         | platform super admin |       |
| PUT    | `/api/admin/plans/{id}`                    | platform super admin |       |
| GET    | `/api/admin/subscriptions`                 | platform super admin |       |
| GET    | `/api/admin/system`                        | platform super admin |       |
| GET    | `/api/admin/tenants`                       | platform super admin |       |
| GET    | `/api/admin/tenants/{id}`                  | platform super admin |       |
| PATCH  | `/api/admin/tenants/{id}/status`           | platform super admin |       |
| GET    | `/api/admin/users`                         | platform super admin |       |
| PATCH  | `/api/admin/users/{id}/status`             | platform super admin |       |

### Purchases

| Method | Path                         | Access                      | Notes |
| ------ | ---------------------------- | --------------------------- | ----- |
| GET    | `/api/purchases`             | permission: purchase.view   |       |
| POST   | `/api/purchases`             | permission: purchase.manage |       |
| GET    | `/api/purchases/{id}`        | permission: purchase.view   |       |
| POST   | `/api/purchases/{id}/cancel` | permission: purchase.cancel |       |

### Reports

| Method | Path                 | Access                  | Notes |
| ------ | -------------------- | ----------------------- | ----- |
| GET    | `/api/reports/{key}` | permission: report.view |       |

### Sales & POS

| Method | Path                       | Access                      | Notes |
| ------ | -------------------------- | --------------------------- | ----- |
| GET    | `/api/sales`               | permission: sale.view       |       |
| POST   | `/api/sales`               | permission: sale.create     |       |
| GET    | `/api/sales/{id}`          | permission: sale.view       |       |
| POST   | `/api/sales/{id}/cancel`   | permission: sale.cancel     |       |
| POST   | `/api/sales/{id}/payments` | permission: payment.receive |       |
| POST   | `/api/sales/{id}/refunds`  | permission: sale.refund     |       |

### Subscription

| Method | Path                       | Access                          | Notes |
| ------ | -------------------------- | ------------------------------- | ----- |
| GET    | `/api/plans`               | public                          |       |
| GET    | `/api/subscription`        | permission: subscription.manage |       |
| POST   | `/api/subscription/change` | permission: subscription.manage |       |

### Team

| Method | Path                  | Access                      | Notes |
| ------ | --------------------- | --------------------------- | ----- |
| GET    | `/api/employees`      | permission: employee.view   |       |
| POST   | `/api/employees`      | permission: employee.manage |       |
| DELETE | `/api/employees/{id}` | permission: employee.manage |       |
| PATCH  | `/api/employees/{id}` | permission: employee.manage |       |
| GET    | `/api/permissions`    | permission: employee.view   |       |
| GET    | `/api/roles`          | permission: employee.view   |       |
| POST   | `/api/roles`          | permission: role.manage     |       |
| DELETE | `/api/roles/{id}`     | permission: role.manage     |       |
| PUT    | `/api/roles/{id}`     | permission: role.manage     |       |

## Example

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/token -H "content-type: application/json" \
  -d '{"email":"owner@rahmanstore.demo","password":"Demo12345"}' | jq -r .accessToken)

curl -s -X POST localhost:4000/api/sales -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{
  "items": [{ "productId": "<id>", "quantity": "2" }],
  "payments": [{ "method": "BKASH", "amount": "500.00", "reference": "8N7X2K" }],
  "idempotencyKey": "till-1-000042"
}'
```
