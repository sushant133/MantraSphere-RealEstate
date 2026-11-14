# MantraSphere Real Estate

Property listing platform for Nepal: Next.js 15 (App Router) · TypeScript · Tailwind v4 + shadcn/ui (Radix) · MongoDB 7 + Mongoose 8 · next-intl (English / नेपाली).

> Status: **Phase 5 (Payments + plan engine) complete.** See "Build phases" below.

## Local setup

Requirements: Node 22+ (24 works), npm.

```bash
npm install
cp .env.example .env.local
```

### Database (pick one)

**A. Docker (matches production: replica set + auth)**

```bash
# in .env.local set MONGO_ROOT_PASSWORD and MONGO_APP_PASSWORD, then:
npm run db:up
# MONGODB_URI=mongodb://msr_app:<MONGO_APP_PASSWORD>@127.0.0.1:27017/mantrasphere?replicaSet=rs0&authSource=mantrasphere
```

**B. No Docker (dev only, no auth, data in `./.mongo-data`)**

```bash
npm run db:dev            # keep running; first run downloads MongoDB 7 (~600 MB)
# MONGODB_URI=mongodb://127.0.0.1:27017/mantrasphere?replicaSet=rs0
```

### Seed and run

```bash
npm run seed              # 7 provinces, 77 districts, 753 local levels, plans, amenities, settings, FAQ, 30 demo listings
npm run db:sync-indexes   # builds indexes and checks key queries with explain() (fails on COLLSCAN)
npm run dev               # http://localhost:3000 → /en
```

Seed flags: `--no-demo` (use in production), `--reset-demo`, `--purge-demo`, `--fresh` (dev only: drops the DB).

### Checks

```bash
npm run check             # eslint + tsc + vitest
npm run build
npm run test:e2e          # Playwright against a running server; E2E_BASE_URL=http://localhost:3000 by default
```

E2E needs the server started with `SMS_PROVIDER=outbox` and `EMAIL_PROVIDER=outbox` (tests read OTP codes and links from `./.outbox`). E2E uses the system Chrome locally (`channel: "chrome"`). Forms need Turnstile keys: in development use Cloudflare's always-pass test keys (see `.env.example`); **in production, forms fail closed without real keys**.

Notes:
- OTP requests are rate-limited (3 per phone / 15 min, 10 per IP / hour, in memory). Restart the server before repeated e2e runs; the admin spec caches its session in `.playwright/`.
- The seeded admin logs in with OTP on +977 9849361011.
- `npm run dev` uses webpack, not Turbopack: Turbopack (Next 15.5) ignores `images.loaderFile`, which serves the pre-sized photo variants.
- `NEXT_DIST_DIR=.next-check npm run build` builds into a separate folder (useful while a dev server owns `.next`).

## Payments

- **eSewa** works out of the box in test mode (public EPAYTEST credentials). Live: set `ESEWA_ENV=live`, `ESEWA_MERCHANT_CODE`, `ESEWA_SECRET_KEY`.
- **Khalti** appears once `KHALTI_SECRET_KEY` is set (`KHALTI_ENV=live` for production).
- **Bank transfer** is always offered; add accounts in Admin → Site settings. Staff confirm slips in Admin → Payments.
- **Test gateway**: `PAYMENT_MODE=mock` (dev/e2e only; signed links, never enable in production).
- Payments are confirmed server-to-server; completion is idempotent and runs in one MongoDB transaction with the listing/plan update.

### Hourly cron (VPS)

```cron
5 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/expire-listings >/dev/null
```

Expires listings, sends 7-day/1-day reminders (once each), reconciles gateway payments whose browser never returned, and sends saved-search alerts (hourly, daily or weekly per search; email needs a verified address, SMS uses the account phone).

### E2E test server

```bash
npm run build
RATE_LIMIT_MULTIPLIER=50 ALLOW_RATE_LIMIT_MULTIPLIER=1 npx next start -p 3000   # .env.local: SMS/EMAIL_PROVIDER=outbox, PAYMENT_MODE=mock, CRON_SECRET
npm run test:e2e
```

## Conventions

- **Prices** are integer NPR (`priceNpr`) or `priceOnRequest`; never Rs 0. Rent is always per month.
- **Land area** is stored canonically as `areaSqFt` plus the owner's original `areaInput` (Ropani-Aana-Paisa-Daam, Bigha-Kattha-Dhur, sq ft, sq m). See `lib/units.ts`.
- **Phones** are stored in E.164 (`+9779849361011`). See `lib/phone.ts`.
- **Listing codes** come from an atomic counter (`MSR-000123`); slugs are `slugify(title)-code`.
- **Contact details** come only from the `sitesettings` record (`getSiteSettings()`), never hard-coded in components.
- **Query safety:** `mongoose.set("sanitizeFilter", true)` is global. Server-built operator filters must use `trusted({...})` from `lib/db.ts`; text search uses `Property.collection.find(textSearch(q))`. Never pass raw user objects into a filter.
- **Links:** always use `Link` from `@/i18n/navigation` with absolute paths.
- **Search state** lives in the URL (`lib/properties/filters.ts`): `/en/properties?purpose=sale&type=land&district=bhaktapur`. Non-canonical query strings redirect to the canonical one; simple combinations canonicalise to SEO landing pages (`/en/land-for-sale-in-bhaktapur`), others are `noindex, follow`.
- **Images:** `next/image` with a custom loader that picks the pre-built 400/800/1600 px WebP (`lib/image-loader.ts`).
- **Client translations:** wrap client islands in `<IntlScope namespaces={[...]}>` so only the needed messages reach the browser.
- **Property URLs:** middleware answers changed slugs with 301 and deleted listings with 410 (via `/api/internal/slug`). Set `INTERNAL_URL=http://127.0.0.1:3000` in production.

## Data sources

- Administrative divisions: [sagautam5/local-states-nepal](https://github.com/sagautam5/local-states-nepal) (MIT), normalised into `data/nepal-locations.json`.
- Demo listing images are generated locally by `scripts/seed/demo-images.ts` (no third-party photos).

## Demo photos

- Demo listings use 85 **CC0 / public-domain** photos found via [Openverse](https://openverse.org) (sources: WordPress Photo Directory, rawpixel, StockSnap). Each one's source page, creator and licence is recorded in `scripts/seed/demo-photos.json`. CC0 needs no attribution and allows commercial use.
- `npm run seed` downloads them once into `public/uploads/demo-photos/` (git-ignored) through the normal image pipeline; offline, it falls back to drawn illustrations. `npm run seed:photos` fetches them on its own.
- `npm run seed -- --refresh-demo-images` swaps the photos on existing demo listings without changing their codes or links.
- Houses get exterior, living room, kitchen, bedroom and bathroom shots; flats similar; land gets field and hillside shots (mostly from Nepal); shops and offices get commercial and office shots.
- These are demo photos only: purge them with `npm run seed -- --purge-demo` before launch.
- Site images in `public/images/` (home hero, "Browse by type" tiles, CTA band) are committed and come from the same CC0 set: hero = `house-09`, tiles = `house-06`, `land-10`, `flat-06`, `commercial-01`, `living-07`, CTA = `land-12` (sources in `demo-photos.json`). Replace them with the company's own photos whenever you have them; keep the `-400/-800/-1600.webp` names.

## Content and PWA notes

- CMS text is Markdown rendered by `lib/markdown.ts` (raw HTML escaped, only http(s)/relative/mailto links). `npm run seed` inserts the legal pages, three guides and general FAQs once; admin edits are never overwritten.
- The Privacy policy and Terms are **drafts for legal review**; Nepali versions fall back to English with a notice until translated.
- Icons: `node scripts/make-icons.mjs` rebuilds `public/icons/*` from the logo mark.
- `public/sw.js` never caches pages (only hashed JS/CSS and listing photos) and is registered in production only. Bump `VERSION` in it to drop old caches.
- Format numbers with `formatNumber()` from `lib/price.ts`, never `Intl.NumberFormat("ne-NP")`: Chrome and Node disagree on its digits, which breaks hydration.

## Build phases

1. ✅ Setup: Next.js, Tailwind, shadcn, MongoDB replica set, models + indexes, seed, i18n, layout, design tokens
2. ✅ Public browsing: home sections, properties (filters/URL state/pagination/infinite scroll/map), SEO landing pages, detail page (gallery, contact reveal, enquiry → lead, share, report, similar), OG images, JSON-LD, sitemap/robots, 301/404/410
3. ✅ Auth + owner dashboard: phone OTP, email/password (+ verification, reset), Google; dashboard, post-property wizard with autosave, photo pipeline, leads inbox, profile + verification documents
4. ✅ Admin panel (/en/admin, English-only): dashboard + chart, moderation (approve on a plan / reject with reason), reports, listings, users & roles, verification documents, leads + CSV export, site settings, config-driven CMS (plans, blog, FAQ, testimonials, banners, amenities, districts, local levels), CSV/Excel import, audit log
5. ✅ Payments + plan engine: pay-before-review checkout (eSewa, Khalti, bank transfer + staff verification), idempotent transactional completion, renew/upgrade, PDF receipts, pricing page, hourly cron (expiry, 7-day/1-day reminders, payment reconciliation)
6. ✅ Extras: About, Contact (form → lead + office email), FAQ (FAQPage JSON-LD), Privacy and Terms (Admin → Content → Legal pages, Markdown), blog (safe Markdown, BlogPosting JSON-LD, sitemap), EMI calculator (bank rates in Admin → Settings), land-unit converter, compare up to 3 listings, saved properties synced to the account, saved searches with email/SMS alerts, installable PWA (manifest, icons, offline page, service worker)
7. Hardening + deploy (Nginx, PM2, backups)
