# UI upgrade report: marketing site and auth flow

Plan: [ui-upgrade-plan.md](ui-upgrade-plan.md). There is one commit per phase on `main`. The scope was the marketing site, header, footer, login and register. No backend business logic, schema or API contract changed.

## Phase 0: critical bugs (`fa65038`)

| Problem                                                            | Cause                                                                                                                                                                                   | Fix                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/pricing` showed grey skeletons forever                           | The page only rendered after `/api/plans` answered, and a cold API returns 502.                                                                                                         | `config/plans.ts` holds a static plan catalogue (mirrors the API seed) that renders immediately. `usePlans()` tries `/api/plans` with a 5 s timeout and swaps in live data if it arrives. A failed fetch keeps the static plans. No skeleton remains.                 |
| `/login` and `/register` ended on the "Starting the server" loader | Middleware redirected anyone with an `hk_csrf` cookie from the auth pages to `/dashboard` (307). That cookie outlives the access token, so the dashboard then waited on a sleeping API. | The redirect is removed. The auth pages always render immediately.                                                                                                                                                                                                    |
| Submitting while the API was asleep failed                         | Vercel's proxy gives up after 30 s, and a Render cold start takes longer.                                                                                                               | `lib/wake.ts`: every page load starts waking the API with `/api/health`. On submit, a form first waits for a health check, showing "Connecting to server…" only if it has to wait, then sends the POST. After 90 s it shows a clear error and the button works again. |
| Header                                                             |                                                                                                                                                                                         | Visitors see a "Sign in" link and a "Start free trial" button. "Open dashboard" appears only after `/auth/session` confirms a live session. Below `md` the menu is a Radix drawer.                                                                                    |
| Keep-alive                                                         |                                                                                                                                                                                         | `.github/workflows/keepalive.yml`, documented in the README. See the TODO list for why it is off by default.                                                                                                                                                          |

## Phase 1: English and Bangla (`bb70b96`)

- **How the language is stored:**
  - Saved in the `hk_lang` cookie for one year. A visitor with no cookie whose browser prefers Bangla gets Bangla.
  - There are no URL prefixes, so existing links and paths are unchanged. `<html lang>` follows the cookie.
- **Dictionaries and helpers:**
  - `lib/i18n/en.ts` and `bn.ts`. `bn.ts` is type-checked against `en.ts`, so a missing key fails the build.
  - `getI18n()` for server components and `useI18n()` for client components.
  - Validation messages (zod defaults and our own) and API error messages are translated.
- **Scope:** every marketing page, the header, drawer, footer, login and register, plus page titles and descriptions.
- **Copy:** the Bangla is written the way shopkeepers talk (বাকি, হিসাব, স্টক, খাতা). bKash, Nagad, Rocket, POS, PDF and SKU stay in English. Counts in running text use Bangla numerals (৫০টি পণ্য, ১৪ দিন). Amounts keep ৳ with Latin digits and lakh grouping.
- **Switchers:** a language switcher in the header, the mobile drawer, the footer and the auth pages. A theme toggle sits next to it.
- **Font:** Hind Siliguri stays self-hosted through `@fontsource`, which is already in the font stack and needs no network at build time. I added the 500 weight and gave Bengali text more line height without negative tracking. "চানাচুর" and the rest of the Bangla renders correctly in both languages.

## Phase 2: home page (`b9b0a2f`)

- **Animated hero invoice** (Framer Motion). It plays once when it comes into view:
  - items appear one by one;
  - the total counts up;
  - the "Paid by bKash" line appears, then the dues line;
  - the stock badge ticks 6, 5, 4.
  - With reduced motion it shows the finished invoice.
- **Hero backdrop:** faint ruled lines and a margin rule (a khata page) over a soft navy and emerald gradient.
- **Step visuals:** each step has a small React component: a counter search box, stock and dues badges, and a PDF invoice thumbnail.
- **"Built for how shops here actually run":** shop-type chips with Lucide icons.
- **Product preview:** real dashboard screenshots taken locally with the demo seed (`public/product/dashboard-{light,dark}.webp`). They sit in a browser frame that straightens on scroll, and the dark-mode screenshot shows in dark mode.
- **Payments strip:** Cash, bKash, Nagad, Rocket, Card and Bank transfer as text badges, with no brand logos.
- **FAQ:** six questions, built on `<details>` with FAQPage structured data.
- **Testimonials:** `components/marketing/testimonials.tsx` reads `config/testimonials.ts`. The list is empty with a TODO, so the section is not rendered.

## Phase 3: other pages (`187a986`, contact and footer in `bb70b96`)

- **Features:**
  - Jump chips at the top.
  - Alternating text and visual layout, with a Lucide icon and a small ledger card of example figures per module.
  - All existing feature text is kept.
- **Pricing:**
  - "Most popular" badge on Basic.
  - The price slides when switching Monthly and Yearly.
  - A comparison table built from plan limits and flags.
  - A pricing FAQ.
  - Its own title and description.
- **About:** the story, a three-card values row, a founder placeholder (TODO) and a "Made in Sylhet, Bangladesh" block.
- **Contact:**
  - Inline validation (on blur, then while typing) with loading, connecting and success states.
  - A "Send another message" option.
  - WhatsApp, phone and email come from `NEXT_PUBLIC_*` variables and are hidden when unset.
- **Footer:** product and company columns, the language switcher and theme toggle, and social links that only appear when configured.

## Phase 4: polish (`c4ef9e4`, plus the logo fix in the final commit)

- **Contrast:**
  - Muted text moved to slate-600: 7.4:1 on white, up from 5.7:1.
  - Green text darkened from 3.8:1, which failed AA, to 5.6:1.
  - Dark-mode muted text raised to 8.7:1.
- **Motion and focus:**
  - Section fade-ins through one shared `Reveal` component.
  - Hover lift and shadow on buttons and cards.
  - The global focus ring is unchanged.
  - Everything respects `prefers-reduced-motion`.
- **Dark mode:**
  - Toggle on the marketing and auth pages.
  - Navy blocks get a ring in dark mode.
  - The logo tile turns white on dark backgrounds; it disappeared before.
- **PWA:**
  - `app/manifest.ts`: opens on `/dashboard`, with shortcuts to New sale and Products.
  - Icons: 192 and 512 PNG, a maskable icon and an apple-touch-icon.
  - A theme colour for each colour scheme.
- **Metadata:**
  - A generated Open Graph card (`app/opengraph-image.tsx`).
  - Per-page title, description, canonical URL, Open Graph and Twitter tags through `lib/seo.ts`. Pricing now has its own title.
  - `sitemap.xml` and `robots.txt`.

## Verification

- **Checks:** `lint` (0 errors), `typecheck` and `build` pass after every phase.
- **Page matrix (Playwright):**
  - 7 pages (home, features, pricing, about, contact, login, register) at 375, 768 and 1280 px, in light and dark, in English and Bangla: 84 renders.
  - Each render was checked for horizontal overflow, console and page errors, em dashes in visible text, the theme being applied and `<html lang>`. No issues were found. Screenshots were reviewed by eye for a subset.
- **Backend down:** I stopped the API process and checked:
  - Pricing renders all three plans with no skeleton.
  - Login and register forms render immediately.
  - Submitting shows "Connecting to server…". After 90 s it shows "We could not reach the server. Check your connection and try again." and the button works again.
  - `/login?offline=1` shows the offline notice.
  - The contact form shows the connecting notice.
- **Backend up:**
  - Bangla validation messages appear.
  - A wrong password shows "ইমেইল বা পাসওয়ার্ড ভুল".
  - Demo login reaches `/dashboard`.
  - The header shows "ড্যাশবোর্ডে যান" for a signed-in visitor.
  - `/login` stays reachable while signed in.

A test gotcha worth knowing: Next.js fixes the `/api` rewrite destination at build time. Changing `API_ORIGIN` when running `next start` does nothing, so to simulate a dead backend you have to stop the API itself.

## TODOs for you

1. **Testimonials:** add real quotes, with written permission, to `apps/web/src/config/testimonials.ts`. The section appears automatically.
2. **Founder photo and name:** set `FOUNDER` in `apps/web/src/app/(marketing)/about/page.tsx` and put the photo in `public/about/`.
3. **Contact details and social links:** set these in Vercel. Each one is hidden until it is set.
   - `NEXT_PUBLIC_WHATSAPP_NUMBER` (digits with country code)
   - `NEXT_PUBLIC_CONTACT_PHONE`
   - `NEXT_PUBLIC_CONTACT_EMAIL`
   - `NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_YOUTUBE_URL`, `NEXT_PUBLIC_LINKEDIN_URL`
   - Optionally `NEXT_PUBLIC_SITE_URL` once you have a custom domain.
4. **Keep-alive:** choose one.
   - **Recommended (free):** a free cron-job.org or UptimeRobot monitor on `https://hisabkhata-omega.vercel.app/api/health` every 10 minutes.
   - **GitHub Actions:** set the repository variable `KEEPALIVE_ENABLED=true`. On a private repository this uses about 4,300 Actions minutes a month, which is more than the free 2,000.
5. **Screenshots:** the product preview uses demo data, where "Sales today" shows ৳0.00 because the demo seed's sales end the day before it was captured. To refresh them, log in as the demo owner on a seeded local copy and replace `public/product/dashboard-{light,dark}.webp`.
6. **Plan prices:** if you change a price in the admin panel, update `apps/web/src/config/plans.ts` too. The live API overrides it whenever it answers, but the static copy is what visitors see during a cold start.

## Not done, and why

- **Vercel Cron keep-alive:** the Hobby plan only allows one run per day, and a more frequent schedule fails the deploy. The keep-alive is a GitHub workflow instead (see TODO 4).
- **`next/font` for Hind Siliguri:** I kept `@fontsource`. It is already self-hosted and in the font stack. `next/font/google` would download from Google at build time and add nothing over the existing setup.
- **Translating the rest of the auth area** (forgot password, reset password, email verification) **and the app itself:** outside this brief, which covered login and register. Those pages stay in English for now, even though the language switcher is visible on them.
- **Offline mode:** the FAQ says plainly that a connection is needed to save a sale. A real offline mode would need a service worker and a sync queue for sales, which is a separate project.
