## Goal

Make every store (subdomain or custom domain) properly indexable with its own sitemap, robots, and identity JSON-LD, and give merchants a self-serve SEO panel to control titles, descriptions, OG images, and social profile links.

Includes the user's hard requirement: when a store has a custom domain, the **subdomain copies of `/sitemap.xml` and `/robots.txt` must redirect (301) to the custom domain** so Google sees ONE canonical sitemap per store (Shopify primary-domain rule). When no custom domain is set, the subdomain serves them directly.

---

## Phase 1 — Per-store SEO foundation

### 1A. Sitemap / robots primary-domain redirect (the user's main ask)

Today `seo-page` already builds a per-store sitemap and robots from the request hostname — so the URLs inside the file always match the host that served it. What it does NOT do: if the store has `custom_domain` set, hitting `brand.shopbanao.in/sitemap.xml` still serves a subdomain sitemap. That splits the SEO signal across two hosts.

Fix in the **Cloudflare Worker** (`docs/cloudflare-worker-current.js`, `handleSeoFiles`):

```text
incoming /sitemap.xml or /robots.txt
   │
   ├─ on custom domain ──────────────► serve via seo-page (host = custom domain)
   │
   └─ on subdomain ─┐
                    ├─ store has custom_domain set
                    │   └─► 301 → https://{custom_domain}/sitemap.xml
                    │       (or /robots.txt)
                    │
                    └─ no custom_domain
                        └─► serve via seo-page (host = subdomain)
```

To know whether a subdomain store has a custom domain without a DB hit per request, reuse the existing storefront shell lookup (already cached in the Worker). If unavailable, the edge function returns the redirect itself (cheap one-time check, cached 1h).

### 1B. Sitemap content gaps

`seo-page → handleSitemap` currently includes home, /shop, /contact, /best-sellers, categories, products, and a hardcoded list of legal pages. Missing:

- Custom pages from `store_pages` table (merchants build their own pages — currently invisible to Google).
- Conditional gating: only include `/about`, `/privacy-policy`, etc. when the matching `store_pages` row exists (avoid 404s in sitemap).
- `<lastmod>` from `store_pages.updated_at` and `categories.updated_at` (today categories have no lastmod).

### 1C. Per-store identity JSON-LD (Knowledge Graph signal)

`useStoreJsonLd` already emits a single `Store` schema. Split it into three stacked schemas so Google can build a brand entity:

1. **Organization** — name, url, logo, sameAs (instagram + facebook + whatsapp wa.me link), contactPoint.
2. **WebSite** — name, url, `potentialAction` SearchAction → `{base}/shop?q={search_term_string}`. This is what triggers the sitelinks search box.
3. **Store / LocalBusiness** — keep current address + priceRange + contactPoint.

All three use `getStoreBaseUrl(slug, customDomain)` so URLs always point to the primary domain.

### 1D. Per-store `llms.txt`

Add `type: "llms"` to `seo-page` and route `/llms.txt` through the Worker the same way sitemap/robots are routed. Body: store name, URL, short description, top categories, key pages. Same primary-domain redirect rule as 1A.

### 1E. Canonical hardening (verify, no code change expected)

Spot-check `useMetaTags` and product/category pages — `getStoreBaseUrl` already prefers custom_domain, so canonicals should already be correct. Confirm and document.

---

## Phase 2 — Merchant SEO controls in the dashboard

`StoreSettings.tsx` already has a SEO section with `meta_title`, `meta_description`, `og_image_url`, `instagram_url`, `facebook_url`. We extend it without breaking layout:

### 2A. Live preview + character counters
- Google SERP preview card (title, URL, description) using current `getStoreBaseUrl` result.
- Facebook/WhatsApp share preview card using OG image + title + description.
- Character counters with green/amber/red thresholds (title 50–60, description 140–160).

### 2B. Sitemap & robots helper card
- Show the canonical sitemap URL (auto-switches between custom domain and subdomain).
- Copy-to-clipboard button.
- "Submit to Google Search Console" CTA → opens GSC with prefilled URL.
- "Verify ownership" CTA → opens GSC site verification.
- Inline note explaining: "When you add a custom domain, your subdomain sitemap automatically redirects to the custom domain version — no extra work."

### 2C. Google Business Profile claim CTA
- Single button linking to `https://business.google.com/create` with prefilled name + website + phone via URL params.
- Helper text: "A claimed Google Business Profile is the #1 driver of brand search ranking."

### 2D. Social profile widening (only if missing today)
- Add fields for YouTube, X/Twitter, LinkedIn if the columns exist; otherwise skip.
- These feed `sameAs` in Organization JSON-LD (Phase 1C).

### 2E. Cache purge on save
- Saving SEO fields already purges store cache via existing flow. Verify it also purges sitemap/robots at the edge by including `/sitemap.xml`, `/robots.txt`, `/llms.txt` in the purge list.

---

## Out of scope (saved for Phase 3+)

- Auto-submit sitemap to GSC via API per store — needs per-merchant OAuth, complex. Phase 2 ships manual CTAs.
- Edge SSR for bots (Phase 3 — separate plan).
- Platform-level keyword content pages (Phase 4).

---

## Files touched

**Phase 1**
- `docs/cloudflare-worker-current.js` — primary-domain redirect logic in `handleSeoFiles`, add `/llms.txt` route. *(Manual deploy by user after edits.)*
- `supabase/functions/seo-page/index.ts` — custom pages in sitemap, conditional legal pages, lastmod fixes, new `handleLlms`, redirect helper.
- `src/hooks/useJsonLd.ts` — split `useStoreJsonLd` into Organization + WebSite + Store stack.

**Phase 2**
- `src/pages/StoreSettings.tsx` — SERP/social preview cards, character counters, sitemap helper card, GBP CTA.
- `src/lib/purgeStoreCache.ts` (or wherever purge lives) — include SEO file paths.

No database migration needed — all required columns already exist.
