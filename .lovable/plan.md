## Goal

Lift every storefront's AI-Search-Readiness score from ~20 to 90+ by giving crawlers fully-formed, content-rich HTML at the edge — without changing what humans see and without re-deploying per store.

## Where the work lives

- `docs/cloudflare-worker-current.js` (you deploy once after each version bump)
- `supabase/functions/bot-render/` (already exists — expanded for richer bot HTML)
- 1 SQL migration: a new RPC `get_storefront_seo(slug)` + 3 new columns on `stores`
- `src/pages/StoreSettings.tsx` + a new "SEO & AI Search" admin sub-tab

Nothing in the storefront React runtime changes — humans still get the same UI.

---

## Layer 1 — Expand the worker's hidden SSR block

**File:** `docs/cloudflare-worker-current.js` → `_buildSeoBodyBlock(store, categories, products, shipping)`

Today it only injects `<h1>` + `<p>`. We expand it (using data the worker already has from `get_storefront_shell`) to:

```text
<div id="seo-content" [visually hidden, aria-hidden=false]>
  <h1>{store.name}</h1>
  <p>{seo_about_paragraph || description}</p>
  <p>Location: {city}, {state} · WhatsApp: {whatsapp_number}</p>

  <h2>Shop by Category</h2>
  <ul>{categories.map → <li><a href="/category/{slug}">{name}</a></li>}</ul>

  <h2>Featured Products</h2>
  <ul>{products_preview.map → <li><a href="/product/{slug}">{name} — ₹{price}</a></li>}</ul>

  <h2>Why Choose Us</h2>
  <ul>{usp_bullets.map → <li>{bullet}</li>}</ul>

  <h2>Contact</h2>
  <address>WhatsApp: {whatsapp_number} · {location} · Hours: {business_hours}</address>
</div>
```

Hidden using the existing `clip-path: inset(50%)` pattern (Google-safe, not cloaking — same content React renders). Plumbed into `_buildInstantSkeletonPage()` where `themeLite`/`inlineProducts` already arrive.

## Layer 2 — Full JSON-LD set per store

**Same file** — extend `_buildStorefrontSchemas()` to emit:

1. **Organization** (already exists — keep)
2. **WebSite** with SearchAction (already exists — keep)
3. **LocalBusiness / Store** — new: address, openingHoursSpecification from `business_hours`, geo (optional)
4. **ItemList** of top 20 products (homepage) — new: name, image, price, url
5. **BreadcrumbList** — already in PDP/category path, ensure it fires on every nested route
6. **Product + Offer** on PDP — already exists, verify completeness (add `aggregateRating` only if reviews exist)
7. **FAQPage** — new: rendered when `faq_items` is non-empty (homepage + `/faq`)

All emitted as `<script type="application/ld+json">` in `<head>`, deduped per route.

## Layer 3 — Bot-served real content pages

**File:** `supabase/functions/bot-render/index.ts` (already handles `kind: "about" | "contact" | …`)

Currently bot-render returns thin HTML for policy routes. Expand:
- `/about` → renders `about_us_text` + `seo_about_paragraph` + `usp_bullets` as proper `<article>`
- `/contact` → renders WhatsApp, address, business hours, contact form fallback link
- `/shipping-policy`, `/return-policy`, `/privacy-policy` → render `stores.shipping_policy / return_policy` + a sensible default for privacy
- `/faq` → renders `faq_items` as `<dl>` + emits FAQPage schema

For humans (non-bot UA) these routes keep using React unchanged. For bots, the worker's `handleBot()` already routes through `bot-render` with `kind` → just need richer HTML output.

**Bonus:** also include the Layer-1 SEO block inside the non-bot skeleton so the content is in HTML even for crawlers that ignore UA-based routing (Perplexity, ChatGPT, etc.).

## Layer 4 — Per-store `/llms.txt` and `/sitemap.xml`

Worker already routes `/llms.txt` and `/sitemap.xml` to `serveSeoFile()` — today that hits a static cached file. Switch both to **on-demand generation** from the new `get_storefront_seo(slug)` RPC, cached at the edge for 24h with SWR.

**`/llms.txt`** output:
```text
# {store.name}
> {seo_about_paragraph || description}

{store.name} is an online store based in {city}, {state}. Contact via WhatsApp: {whatsapp_number}.

## Pages
- [Home](/) : Browse all products
- [Shop](/shop) : Full catalog
- [Best Sellers](/best-sellers) : Top picks
- [About](/about) : Our story
- [Contact](/contact) : Get in touch

## Categories
- [{cat.name}](/category/{cat.slug}) : {cat.product_count} products
...

## Products
- [{product.name}](/product/{product.slug}) : ₹{price}
...(top 50)
```

**`/sitemap.xml`** output: full URL list — `/`, `/shop`, `/about`, `/contact`, `/best-sellers`, every active category, every active product, with `lastmod` from `updated_at`.

Both routes work for subdomain and custom domain (canonical base auto-detected).

## Layer 5 — Merchant-editable SEO fields

**Migration** — add 3 columns on `public.stores`:
- `seo_about_paragraph text` (200–400 chars, drives Org.description + Layer 1 paragraph)
- `faq_items jsonb default '[]'` — `[{q, a}]` array (drives FAQPage schema + `/faq` content)
- `usp_bullets text[] default '{}'` — 3–5 short bullets (drives "Why choose us" block)

Plus new RPC `get_storefront_seo(_slug)` that returns the minimal payload used by `/llms.txt`, `/sitemap.xml`, and any future bot route (one round-trip, edge-cacheable).

**Admin UI** — add a "SEO & AI Search" card inside `StoreSettings.tsx`:
- About paragraph textarea (live char counter)
- FAQ editor (add/remove Q&A pairs)
- USP bullets (3–5 inputs)
- Live preview: shows the rendered `/llms.txt` + a "Test in bot view" link
- "Re-warm SEO cache" button → calls existing `prewarm-store` + a new purge for the SEO cache key

## Deploy / rollout

1. SQL migration (3 columns + RPC + GRANTs) — runs once
2. Edge functions auto-deploy — no manual step
3. `docs/cloudflare-worker-current.js` bump to `v8.45.0-seo-readiness` — **you deploy once to Cloudflare**
4. Existing stores: zero action needed — defaults kick in immediately (score ~20 → ~70)
5. Merchants who fill the new fields: score → 90+ (the gap is just real content)

## Verification

- `curl -A "Googlebot" https://serdiyajewellers.shop/` → expect full `<h1>`, `<ul>` of categories/products, all 7 JSON-LD blocks
- `curl https://serdiyajewellers.shop/llms.txt` → expect populated markdown
- `curl https://serdiyajewellers.shop/sitemap.xml` → expect all URLs
- Re-run AnswerLens / Lighthouse SEO audit → expect 90+
- Existing humans: identical UX (verified via preview)

## Technical notes (for reference)

- Worker already has `_buildInstantSkeletonPage`, `_buildStorefrontSchemas`, `_buildSeoBodyBlock`, `_buildPdpCategorySeoHead`, `serveSeoFile`, `handleBot` — all 5 layers plug into existing hooks, no rearchitecture.
- `get_storefront_shell` already returns store + categories + 20 products → Layer 1+2 need **zero new DB calls** on the hot path.
- New `get_storefront_seo` RPC is only called by the cold `/llms.txt` and `/sitemap.xml` routes (low traffic, 24h edge-cached).
- DROP-FIRST rule respected: new RPC, no signature change to existing ones.
- All grants included for `anon` (public-readable SEO data).
