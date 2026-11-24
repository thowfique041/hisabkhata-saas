# Deployment

Target setup, all on free tiers:

| Piece    | Provider                     | Notes                                                   |
| -------- | ---------------------------- | ------------------------------------------------------- |
| Web      | Vercel (Hobby)               | Root directory `apps/web`. Proxies `/api/*` to the API. |
| API      | Render (Free web service)    | `render.yaml` blueprint in the repository root.         |
| Database | Neon (Free)                  | Pooled URL for the app, direct URL for migrations.      |
| Redis    | Upstash (Free)               | BullMQ queues and schedulers.                           |
| Images   | Cloudinary (Free)            | Required in production; Render's disk is ephemeral.     |
| Email    | Brevo (Free, SMTP) or Resend | Verified sender domain recommended.                     |

## Free-tier limits to know (checked November 2026)

- **Render**: free web services spin down after 15 minutes without traffic and take about a minute to wake up; each workspace gets 750 free instance hours per month; the filesystem is ephemeral. Background jobs only run while the instance is awake, so a scheduled job that falls due while it sleeps runs when the next request wakes it. For a real shop, use the $7 Starter instance, which does not sleep.
- **Neon Free**: 100 CU-hours of compute per project per month, 1 GB storage per project, scale to zero after 5 minutes idle (the first query after idle is slower).
- **Upstash Free**: 500K commands per month, 256 MB. BullMQ polls Redis even when idle; the workers are tuned (`drainDelay` 30 s, `stalledInterval` 5 min) to keep this low. If you approach the limit, set `QUEUES_ENABLED=false` (jobs then run inline in the request) or move to pay-as-you-go.
- **Brevo Free**: 300 emails per day over SMTP.
- **Vercel Hobby**: for non-commercial use under Vercel's terms; a paying business should use the Pro plan.

Always check the provider pricing pages before relying on these numbers.

## 1. Database (Neon)

1. Create a project in a region close to Bangladesh (e.g. Singapore, `aws-ap-southeast-1`).
2. Copy two connection strings from _Connection details_:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** → `DIRECT_DATABASE_URL`
     Both need `?sslmode=require`.
3. Migrations run automatically on every Render deploy (`prisma migrate deploy` in the start command). To run them by hand: `DIRECT_DATABASE_URL=... pnpm db:deploy`.
4. Seed once, from your machine: `DATABASE_URL=<direct url> SEED_DEMO_DATA=false SEED_SUPERADMIN_EMAIL=you@example.com SEED_SUPERADMIN_PASSWORD='<strong password>' pnpm db:seed`.

## 2. Redis (Upstash)

Create a Redis database (TLS on) and copy the `rediss://default:<password>@<host>:6379` URL into `REDIS_URL`.

## 3. Cloudinary

From the dashboard copy cloud name, API key and API secret. Images are uploaded as `authenticated` assets under `hisabkhata/<tenantId>/` and only served through the API after an ownership check.

## 4. Email

Brevo: create an SMTP key, then `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER=<login>`, `SMTP_PASS=<smtp key>`, and `MAIL_FROM` with a sender you verified. Resend works the same way over SMTP (`smtp.resend.com`, port 465, `SMTP_SECURE=true`, user `resend`, password = API key).

## 5. API (Render)

1. Render dashboard → _Blueprints_ → _New Blueprint Instance_ → select the repository. Render reads `render.yaml`.
2. Fill every variable marked `sync: false` (see the checklist below). `JWT_ACCESS_SECRET` is generated automatically.
3. Deploy, then open `https://<service>.onrender.com/api/health`. Expected: `{"status":"ok","database":"up","redis":"up",...}`.

## 6. Web (Vercel)

1. _Add New Project_ → import the repository → set **Root Directory** to `apps/web`. Framework: Next.js. `apps/web/vercel.json` sets install and build commands for the monorepo.
2. Environment variable: `API_ORIGIN=https://<service>.onrender.com`.
3. Deploy. Then set the API's `APP_URL` and `CORS_ORIGINS` to the Vercel URL (or your custom domain) and redeploy the API.

Because the browser calls `https://<vercel-domain>/api/...` and Next.js forwards it to Render, cookies are first-party and `COOKIE_SAMESITE=lax` works. Leave `COOKIE_DOMAIN` empty.

## 7. Payments (optional)

SSLCommerz: create a sandbox store, set `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, keep `SSLCOMMERZ_SANDBOX=true` until you have a live store. The IPN URL is sent automatically: `https://<api>/api/billing/webhooks/sslcommerz`. Without these variables only the manual (bank / mobile banking) method is offered, and super admins confirm payments under _Subscriptions_.

## Environment variable checklist (API)

| Variable                                                                       | Required            | Example / note                                                       |
| ------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------- |
| `NODE_ENV`                                                                     | yes                 | `production`                                                         |
| `APP_URL`                                                                      | yes                 | `https://hisabkhata.vercel.app` (links in emails, payment redirects) |
| `API_URL`                                                                      | yes                 | `https://hisabkhata-api-2r1d.onrender.com` (payment IPN URL)         |
| `CORS_ORIGINS`                                                                 | yes                 | comma-separated web origins                                          |
| `DATABASE_URL`                                                                 | yes                 | Neon pooled URL                                                      |
| `DIRECT_DATABASE_URL`                                                          | yes                 | Neon direct URL (migrations)                                         |
| `REDIS_URL`                                                                    | if queues on        | Upstash `rediss://` URL                                              |
| `QUEUES_ENABLED`                                                               | no                  | `true` (default) / `false`                                           |
| `JWT_ACCESS_SECRET`                                                            | yes                 | 32+ random characters                                                |
| `JWT_ACCESS_TTL`                                                               | no                  | `15m`                                                                |
| `REFRESH_TOKEN_TTL_DAYS`                                                       | no                  | `30`                                                                 |
| `COOKIE_SAMESITE`                                                              | no                  | `lax`                                                                |
| `STORAGE_DRIVER`                                                               | yes                 | `cloudinary`                                                         |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`         | yes with Cloudinary |                                                                      |
| `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | yes for email       | without `SMTP_HOST` emails are not sent                              |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX`       | optional            |                                                                      |
| `LOG_LEVEL`                                                                    | no                  | `info`                                                               |

Web: `API_ORIGIN` only.

## Troubleshooting

| Symptom                                            | Cause and fix                                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| First request takes ~1 minute                      | Render free instance waking up. Upgrade to Starter or accept it.                                                                   |
| Login works but every request returns 401          | Web and API on different sites without the proxy. Make sure the browser calls the Vercel domain and `API_ORIGIN` points to Render. |
| `403 Invalid CSRF token`                           | Cookies were cleared or blocked; sign in again. Clients must send `X-CSRF-Token`.                                                  |
| CORS error                                         | Add the exact web origin (scheme + host, no trailing slash) to `CORS_ORIGINS`.                                                     |
| API exits with `Invalid environment configuration` | The log lists each missing or invalid variable.                                                                                    |
| `P1001 Can't reach database`                       | Wrong Neon URL or missing `sslmode=require`; Neon compute may be waking up, retry.                                                 |
| Migrations fail on Render                          | Use the **direct** Neon URL in `DIRECT_DATABASE_URL`, not the pooler.                                                              |
| Images disappear after redeploy                    | `STORAGE_DRIVER` is still `local`. Switch to `cloudinary`.                                                                         |
| No emails                                          | Check `/super-admin/settings` → Email log for errors; verify the sender domain at the provider.                                    |
| Upstash quota warnings                             | Set `QUEUES_ENABLED=false` or upgrade the Redis plan.                                                                              |
| `/api/health` shows `redis: down`                  | Wrong `REDIS_URL` (Upstash needs `rediss://`).                                                                                     |
