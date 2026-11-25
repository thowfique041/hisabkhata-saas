# UI upgrade plan: marketing site and auth flow

## What the repo looks like today

- **Web app:** `apps/web`, Next.js 15 App Router, Tailwind 3, Radix primitives in a small local `components/ui` kit (no shadcn CLI), `lucide-react`, `next-themes`, TanStack Query, React Hook Form and Zod. Fonts come from `@fontsource` (IBM Plex Sans, plus Hind Siliguri for Bengali glyphs) and are already in the Tailwind font stack.
- **Routes:**
  - `(marketing)`: `/`, `/features`, `/pricing`, `/about`, `/contact`.
  - `(auth)`: `/login`, `/register`, password reset and email verification.
  - `(app)`: the product.
  - `super-admin`.
- **How `/api/*` reaches the backend:** a Next.js rewrite in `next.config.mjs` proxies `/api/*` to `API_ORIGIN` (the NestJS service on Render). Vercel's proxy times out after 30 seconds. A Render free instance takes longer than that to wake, which is where the 502s and 504s come from.
- **Pricing:** `/pricing` is a client component that fetches `/api/plans` and renders three skeletons until the data arrives. If the request fails, the skeletons stay forever.
- **Middleware:** redirects signed-out visitors from private pages to `/login`, which is correct. The bug is the other direction: it also redirects anyone who has an `hk_csrf` cookie from `/login` and `/register` to `/dashboard`. That cookie outlives the access token, so a returning visitor with an expired session is sent to `/dashboard` (a 307), then waits on the full-screen loader while the API wakes. This is the "login is blocked" report.
- **Header:** already shows "Sign in" and "Start free" to signed-out visitors and has a simple hamburger. On wide screens it says "Open dashboard" whenever the CSRF cookie exists, even after the session has expired.

## Phase 0: critical bugs

1. **Static plans.** Add `src/config/plans.ts`, mirroring the seeded plans. `/pricing` renders it on the server immediately, with no skeleton. A client fetch of `/api/plans` (5 second timeout) silently replaces the static data when the API answers.
2. **API wake-up.** Add `lib/wake.ts`, a shared `waitForApi()` that polls `/api/health` until it answers. The root providers already ping it on first load.
   - Login, register and contact forms render immediately.
   - On submit, if the API has not answered yet, the form shows "Connecting to server…" inline and waits before sending the request. This avoids sending a POST that Vercel would drop after 30 seconds.
3. **Middleware.** Drop the `/login` and `/register` redirect to `/dashboard`.
4. **Header.** Logged-out visitors get a "Sign in" link and a "Start free trial" button. Logged-in visitors get "Open dashboard", decided by an actual session check, not by the cookie alone. Below `md`, a Radix Dialog drawer replaces the inline menu.
5. **Keep-alive.** Vercel Hobby only allows cron jobs once a day (more frequent schedules fail the deploy), so this uses a GitHub Actions workflow at `*/10 * * * *`.
   - The repo is private, so every run costs at least one Actions minute, about 4,300 a month, which is over the 2,000 free minutes.
   - The workflow is therefore gated behind a repository variable `KEEPALIVE_ENABLED`. A skipped job uses no runner minutes.
   - The README explains the cost and suggests a free external pinger (cron-job.org or UptimeRobot) as the zero-cost option.

## Phase 1: English and Bangla

- No URL prefixes, so existing links and SEO paths stay the same. The language lives in an `hk_lang` cookie.
- `lib/i18n/` holds the `en` and `bn` dictionaries (typed so both have the same keys), plus:
  - a server helper `getI18n()` that reads the cookie;
  - a client `I18nProvider` and `useT()`;
  - a `LanguageSwitcher` that sets the cookie and calls `router.refresh()`.
- Scope: marketing pages, header, footer, login and register. The app itself stays English for now.
- `<html lang>` follows the cookie.
- Hind Siliguri stays self-hosted through `@fontsource`, which is already in the font stack and needs no network at build time. The missing 500 weight is added, and Bengali text gets a slightly taller line height.

## Phase 2: home page

New components under `src/components/marketing/`:

- `HeroInvoice`: Framer Motion, plays once in view, respects reduced motion.
- `HeroBackdrop`: a dot grid with a soft gradient.
- Step visuals: a scan input, stock and dues badges, a PDF thumbnail.
- `ShopTypes`: chips with Lucide icons.
- `ProductPreview`: a real dashboard screenshot taken locally with the demo seed and saved in `public/product/`, in a browser frame that straightens on scroll.
- `PaymentsStrip`: text badges only, no brand logos.
- `Faq`: native `details`.
- `Testimonials`: reads `src/config/testimonials.ts`, which ships empty.

New dependency: `framer-motion`. Nothing else is needed for this phase.

## Phase 3: other pages

- **Features:** an alternating layout with a Lucide icon per module. The existing copy is kept.
- **Pricing:** a "Most popular" badge, an animated price on toggle, a comparison table and an FAQ. `page.tsx` becomes a server component so it can export its own metadata.
- **About:** story, three values, a founder placeholder (TODO) and "Made in Sylhet".
- **Contact:** inline validation, loading and success states, plus WhatsApp, phone and email entries from `NEXT_PUBLIC_*` variables, each hidden when its variable is unset.
- **Footer:** a language switcher, a theme toggle, and social links that only show when configured.

## Phase 4: polish

- Raise `--muted-foreground` contrast (target 4.5:1 or better on both backgrounds).
- One shared `Reveal` component for section fade-ins.
- Card hover lift and focus rings (already global).
- A theme toggle in the marketing header and on the auth pages.
- PWA: `app/manifest.ts`, PNG icons rendered from the logo SVG, theme colour.
- Metadata: a title, description and Open Graph data per page, with a generated `opengraph-image`.

## Files touched (expected)

- `apps/web/src/middleware.ts`, `src/app/layout.tsx`, `providers.tsx`, `globals.css`, `tailwind.config.ts`
- Everything under `src/app/(marketing)/`, plus `src/app/(auth)/{layout,login,register}`
- New:
  - `src/config/{plans,site,testimonials}.ts`
  - `src/lib/{wake.ts,i18n/*}`
  - `src/components/marketing/*`
  - `src/app/manifest.ts`, `src/app/opengraph-image.tsx`
  - `public/icons/*`, `public/product/*`
- `.github/workflows/keepalive.yml`, `README.md`, `.env.example`

No backend business logic, schema or API contract changes.
