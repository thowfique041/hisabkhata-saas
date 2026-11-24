# Authentication and authorization

## Sessions

| Cookie    | Contents                                                                                             | Flags                                                | Lifetime   |
| --------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| `hk_at`   | JWT access token (HS256, `iss=hisabkhata`, `aud=hisabkhata-api`, claims `sub`, `email`, `sa`, `tid`) | HttpOnly, Secure in production, SameSite=Lax, Path=/ | 15 minutes |
| `hk_rt`   | Opaque 48-byte refresh token                                                                         | HttpOnly, Secure, SameSite=Lax, **Path=/api/auth**   | 30 days    |
| `hk_csrf` | Random CSRF token                                                                                    | Readable by JS, Secure, SameSite=Lax                 | 30 days    |

- Refresh tokens are stored as SHA-256 hashes. Each use rotates the token within the same _family_; presenting an already-rotated token revokes the whole family (theft detection).
- Logout, password change and password reset revoke refresh tokens. Changing a member's status revokes their tokens for that business.
- The web client retries a request once after a transparent `POST /api/auth/refresh`, and sends the user to `/login` if that fails.
- API clients (scripts, Swagger) can call `POST /api/auth/token` for a bearer token. Bearer-authenticated requests are not subject to CSRF checks.

## CSRF

Cookie-authenticated `POST/PUT/PATCH/DELETE` requests must send `X-CSRF-Token` equal to the `hk_csrf` cookie (double submit). Combined with `SameSite=Lax` and the strict CORS allow-list this blocks cross-site writes.

## Passwords and accounts

- Argon2id (19 MiB, t=2). Unknown emails still run a hash so timing does not reveal accounts.
- Five failed logins lock the account for 15 minutes. Auth endpoints are rate-limited per IP.
- Verification and reset tokens are random, single-use, stored hashed, and expire after 24 hours and 30 minutes respectively (7 days for invitation links).
- `forgot-password` returns the same response whether or not the email exists.
- Users have a status (`ACTIVE`, `DISABLED`); memberships have their own status per business.

## Roles and permissions

Permissions live in `packages/shared/src/permissions.ts`. Each tenant gets four built-in roles:

| Role    | Summary                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------- |
| Owner   | Every permission. At least one active owner per business is enforced.                           |
| Manager | Inventory, purchases, suppliers, customers, sales (incl. cancel and refund), expenses, reports. |
| Cashier | POS, customers, payments, invoices; read-only products and stock.                               |
| Staff   | Dashboard, read-only products and stock.                                                        |

Owners (or anyone with `role.manage`) can create custom roles. The API checks permissions (`@RequirePermissions(...)`), never role names. Two rules prevent privilege escalation: you cannot grant a permission you do not hold, and only an owner can assign the Owner role.

Price overrides at checkout require `product.manage`.

## Platform super admin

`User.isSuperAdmin` is set only by the seed script or directly in the database. It is re-checked against the database on every admin request, independent of the token. Super admins have no implicit access to tenant data APIs; they use `/api/admin/*`.

## Email verification

Users can use the app before verifying; a banner asks them to confirm. Completing a password reset also marks the email verified, since it proves mailbox ownership.
