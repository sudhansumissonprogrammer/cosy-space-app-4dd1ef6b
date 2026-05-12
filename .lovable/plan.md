## Goal
Make every storefront (custom domain + subdomain) rank in Google like a Shopify/WordPress site. Today every store leaks the ShopBanao platform's meta tags, which is why none of them appear in search.

## Root cause (one bug, 9 symptoms)

The Worker **appends** new SEO tags but never **strips** the original ones from `index.html` (which are the ShopBanao landing page tags). Browsers and Googlebot read the first `<title>`, first `<link rel="canonical">`, first `<meta name="description">` they find — which is always the platform's. The Worker's injected tags come later and are ignored.

Confirmed by curl on `serdiyajewellers.shop`:
- `<title>` = "ShopBanao — Create Your Online Store for Free"
- `<link rel="canonical" href="https://shopbanao.in/">` (catastrophic — Google de-indexes the store)
- `<meta name="description">` = ShopBanao marketing copy
- `<meta name="keywords">` = "ShopBanao, shop banao, ..."
- `<meta name="author" content="ShopBanao">`
- og:image = Lovable preview screenshot

## Full bug list (5 you already found + 4 new)

| # | Bug | Severity | Where |
|---|---|---|---|
| 1 | Original platform `<title>` not stripped → empty store title in Google | KILLER | Worker `injectIntoHtml` |
| 2 | Original `<link rel="canonical">` to shopbanao.in not stripped → de-indexes every store | KILLER | Worker `injectIntoHtml` |
| 3 | Original platform `<meta name="description">` and `keywords`/`author` not stripped | KILLER | Worker `injectIntoHtml` |
| 4 | Original og:title/og:description/og:image not stripped → wrong social previews | HIGH | Worker `injectIntoHtml` |
| 5 | No JSON-LD schema (Organization, WebSite, Product, BreadcrumbList) | HIGH | Worker `injectIntoHtml` |
| 6 | robots.txt on custom domain still says `Sitemap: serdiyajewellers.shopbanao.in/sitemap.xml` because worker doesn't forward hostname to seo-page | HIGH | Worker `handleSeoFiles` + `seo-page/index.ts handleRobots` |
| 7 | No static H1 / store name / description in body — Googlebot indexes a blank shell | MEDIUM | Worker `injectIntoHtml` |
| 8 | PDP and category pages get **only** the homepage meta — every product page tells Google "Serdiya Jewellers — Shop Online" instead of the product name + price | HIGH | Worker (no per-route meta logic) |
| 9 | No per-product `meta_title` / `meta_description` columns in DB; merchants can't customize SEO per product | MEDIUM | DB + dashboard UI |

## Plan

### Phase 1 — Worker HTML rewriter (the unblocker)

Refactor `injectIntoHtml` (and the streaming variant) in `docs/cloudflare-worker-current.js` so it **rewrites** the `<head>` instead of appending:

1. **Strip these tags** from the source HTML before injecting:
   - `<title>...</title>`
   - `<link rel="canonical" ...>`
   - `<meta name="description" ...>`, `<meta name="keywords" ...>`, `<meta name="author" ...>`
   - `<meta property="og:*" ...>`, `<meta name="twitter:*" ...>`
   - `<meta name="theme-color" ...>` (replace with store's primary color)
2. **Inject per-store replacements** using `store.meta_title`, `meta_description`, `custom_domain`, `og_image_url`, `logo_url`, `banner_url`.
3. **Build JSON-LD** server-side and inline it:
   - Homepage → `Organization` + `WebSite` (with `SearchAction`)
   - PDP → `Product` + `Offer` (price, availability, currency=INR) + `BreadcrumbList`
   - Category → `CollectionPage` + `BreadcrumbList`
4. **Inline a static SEO snippet** into the body skeleton (hidden visually but readable by crawlers): `<h1>{store.name}</h1><p>{store.description}</p>` — overwritten by React on hydrate.
5. **Per-route meta** — when path is `/product/:slug` use the inline product (already in `__PRODUCT_INLINE__`) to set title = `${product.name} — ${store.name}`, description = product description, og:image = product image, canonical = `https://{host}/product/{slug}`. Same logic for `/category/:slug`.
6. **Remove the streaming path's `document.title = ...` JS hack** — once tags are stripped + injected, both paths produce correct static HTML.

### Phase 2 — Sitemap & robots fix

1. In `docs/cloudflare-worker-current.js handleSeoFiles`: pass `hostname` as `domain` to the edge function: `callEdgeFunction("seo-page", { type: "robots", slug, domain: hostname })` and same for sitemap.
2. In `supabase/functions/seo-page/index.ts handleSitemap`: when `domain` param is present, prefer it over `store.custom_domain` (so subdomain visitors get a subdomain sitemap and custom-domain visitors get a custom-domain sitemap — Google requires the sitemap to be on the same host as the URLs it lists).
3. Also include category image entries in sitemap and add `<priority>0.9</priority>` for best-sellers.

### Phase 3 — Auto SEO defaults (zero merchant work)

Most merchants leave SEO fields blank. Build a deterministic fallback ladder so SEO works **automatically** the moment a store goes live:

```
title       = meta_title || `${name} — ${primary_category} Online | {city}`
description = meta_description || description || `Shop ${primary_category.toLowerCase()} from ${name}. Cash on delivery, fast shipping across India.`
og:image    = og_image_url || banner_url || mobile_hero_url || logo_url || generated-OG (store name on brand color)
keywords    = derived from category names + store.name + city
```

For products without per-product meta:
```
title       = `${product.name} — ${store.name}` (capped at 60 chars)
description = first 155 chars of product.description, fallback to `${product.name} from ${store.name}. Order on WhatsApp or COD.`
```

### Phase 4 — Per-product SEO (DB + dashboard)

1. Migration: add `meta_title TEXT`, `meta_description TEXT`, `og_image_url TEXT` to `products` table (nullable).
2. Migration: add same to `categories` table.
3. Dashboard UI: add an "SEO" accordion in the product editor and category editor with these 3 fields + character counters + live Google preview.
4. Worker reads these when building per-route meta in Phase 1, step 5.

### Phase 5 — Custom domain auto-fix on attach

When a merchant attaches a custom domain (existing flow that updates `stores.custom_domain`):
1. Already-handled: sitemap regenerates with new domain (DB-driven).
2. Add: trigger an edge function to call `/api/purge-store` so the cached HTML with old subdomain canonicals is flushed within seconds.
3. Add: after attach success, show a one-click "Submit to Google" CTA in dashboard that opens the Search Console URL inspector pre-filled with the new domain.

### Phase 6 — Optional polish (skip if you want to ship fast)

- `<html lang="{store.language || 'en-IN'}">` rewrite
- `hreflang="x-default"` self-referencing
- BreadcrumbList JSON-LD on every page
- Server-render the first 6 product cards as plain `<a>` tags (helps Googlebot follow internal links without JS)
- `og:image` auto-generation: edge function that takes a store and renders a 1200×630 PNG with logo + name + brand color, cached in R2

## Risk

- **Stripping existing tags is regex-based on streamed HTML.** Test against the current `index.html` shape; gate behind a worker version flag so it can be rolled back fast.
- **JSON-LD must be valid.** Bad schema = Google ignores it (no penalty, but no rich snippets either). Validate with structured-data linter before shipping.
- **No data migration risk** in Phase 4 — new columns are nullable, existing stores keep working.

## Expected outcome

- **Within 24h after deploy:** Googlebot recrawls, sees correct canonicals + titles per store.
- **2-4 weeks:** stores appear when searching brand name (e.g., "serdiya jewellers").
- **4-8 weeks:** product pages start ranking for long-tail queries like "imitation mangalsutra under 500".
- **6-8 weeks:** rich snippets (price, image, availability) appear in search results once Google validates the Product JSON-LD.

## Suggested ship order

1. **Phase 1 + Phase 2** together (one worker deploy + one edge function deploy). This alone unblocks 90% of the SEO problem.
2. **Phase 3** auto-defaults in same deploy (no extra risk).
3. **Phase 4** DB + dashboard SEO UI as a follow-up (1-2 days work).
4. **Phase 5** purge-on-attach as a small addition.
5. **Phase 6** optional, ship later.
