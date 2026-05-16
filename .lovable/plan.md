## Phase 1 & 2 — Verification

Both phases are live in code. No fixes needed:

- **Phase 1 (edge SEO)**: `seo-page` function serves `/sitemap.xml`, `/robots.txt`, `/llms.txt`. `buildPrimaryDomainRedirect` 301s subdomain → custom domain when one is configured. Sitemap includes products, categories with `lastmod`, custom `store_pages`, product images. Worker (v8.15.0) routes all three paths through `seo-page`. JSON‑LD stack (`Organization` + `WebSite`+`SearchAction` + `Store`) emitted by `useJsonLd` for every storefront.
- **Phase 2 (merchant dashboard)**: `SearchEngineHelperCard` in `StoreSettings.tsx` shows copy-able sitemap/robots/llms URLs (auto-switches to custom domain), GSC verification CTA, GSC sitemap-submit CTA, GBP claim CTA with prefilled name/phone/city.

## Phase 3 — Bot SSR (extend, don't rebuild)

`bot-render` edge function and worker bot pipeline (24h edge cache + 7d SWR) **already exist** for product pages and store home. The gap is route coverage — Googlebot currently gets JS-only HTML for category, custom pages, and shop listings.

### Changes

1. **Worker `handleBot` (`docs/cloudflare-worker-current.js`)**
   - Replace the single `productSlug` extraction with a richer `getBotRoute(pathname)` returning `{ kind, slug }` where `kind ∈ product | category | page | shop | best-sellers | categories | about | contact | track-order`.
   - Pass `kind` + `slug` (when present) to `bot-render` as new query params; keep current `product=` param for backwards compatibility.
   - Keep the bot-cache key keyed on full pathname (already is).

2. **`bot-render` edge function**
   - Add branches for the new `kind` values:
     - **category** → fetch category + its products via existing `get_category_with_products` RPC (already used by worker). Emit `ItemList` + `BreadcrumbList` JSON‑LD, `<h1>{category}</h1>`, anchor links to each PDP.
     - **page** → fetch `store_pages` row by slug; render its sanitized HTML body inside the same shell as store home. Add `WebPage` JSON‑LD.
     - **shop / best-sellers / categories** → reuse `buildStoreHtml` but with a filtered/sorted product set + page-specific `<title>`/meta.
     - **about / contact / track-order** → static shell with store name, address, WhatsApp number (already in `stores` row).
   - Every page gets `BreadcrumbList` JSON‑LD and a canonical pointing at the primary domain (custom domain when present).
   - Cap product list at 50 to keep response < 200KB.

3. **Sitemap parity**
   - `seo-page` sitemap already lists products + categories + custom pages. Add `/shop`, `/best-sellers`, `/categories`, `/about`, `/contact` as static rows so Googlebot discovers them.

4. **Manual worker deploy** (worker file is not bundled by Vite — user must redeploy `docs/cloudflare-worker-current.js`).

## Phase 4 — Platform SEO + GSC

### 4a. Blog/guides on shopbanao.in

Add a lightweight content section served from the **landing app** (LandingApp.tsx) so it stays off the storefront critical path.

- New route `/guides` and `/guides/:slug` in `LandingApp.tsx`.
- Source: static MDX or a small `guides` array in `src/content/guides/`. No DB, no React Query — keeps landing bundle small (constraint memory).
- Each guide page: `<Helmet>` (install `react-helmet-async`) for per-page `<title>`, meta description, canonical, `Article` + `BreadcrumbList` JSON‑LD, `og:image`.
- Add `/guides` and every guide slug to `public/sitemap.xml` (the root-domain landing sitemap, separate from per-store sitemaps).
- First three guides (matching Semrush gaps from earlier analysis):
  1. "How to create a WhatsApp store in India (2026)" — target `whatsapp store` (1K/mo, KD 43)
  2. "Best free online store builder for India" — target `online store builder india` (140/mo, KD 0) + `free online store` (480/mo, KD 43)
  3. "Shopify alternative for India: 5 cheaper options" — target `shopify alternative india` (20/mo, KD 0)
- Each guide ends with a CTA linking to `/signup`.

### 4b. Google Search Console wiring

- Trigger `standard_connectors--connect` with `connector_id: google_search_console` so the user authorizes once at the workspace level.
- Add a tiny `gsc-submit` edge function that, on successful publish of a store (or first custom-domain verification), calls the gateway to (i) submit the site, (ii) submit `<base>/sitemap.xml`. This makes "indexable from day 1" automatic for every new merchant.
- Surface a "Submitted to Google" badge in `SearchEngineHelperCard` once the function returns success (store column `gsc_submitted_at`).

### Out of scope (this round)
- Per-merchant OAuth (merchants verifying their own GSC properties) — requires building an OAuth app and per-store token storage. Workspace-level connector covers shopbanao.in + custom domains added by us; merchant self-serve is a later phase.
- Edge SSR for logged-in/human traffic (we keep bot-only SSR — humans still get the SPA).

### Technical summary

```text
docs/cloudflare-worker-current.js     +getBotRoute(), pass kind to bot-render
supabase/functions/bot-render/index.ts +category/page/shop/best-sellers/static handlers, BreadcrumbList JSON-LD
supabase/functions/seo-page/index.ts   +static landing-page rows in handleSitemap
supabase/functions/gsc-submit/index.ts NEW — gateway call to add site + submit sitemap
src/LandingApp.tsx                    +/guides, /guides/:slug routes (lazy)
src/content/guides/*.mdx              NEW — 3 seed guides
src/pages/Guides.tsx, GuideDetail.tsx NEW — with <Helmet> SEO
public/sitemap.xml                    +/guides rows
src/pages/StoreSettings.tsx           +"Submitted to Google" badge wiring
```

Deploy notes: edge functions auto-deploy; worker requires manual redeploy after the bot-router change.
