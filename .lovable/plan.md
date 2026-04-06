

## Plan: Automatic Per-Store SEO (Shopify-Level Independence)

### What Already Works
The platform already has significant store-level SEO infrastructure:
- **Cloudflare Worker** serves per-store `robots.txt` and `sitemap.xml` (with all products, categories, pages)
- **bot-render edge function** serves full HTML with OG tags, JSON-LD, and canonical URLs to search engine crawlers
- **seo-page edge function** generates sitemaps, product feeds, share pages, and OG metadata per store
- **AI content generation** on store creation already generates `meta_title`, `meta_description`, and `about_us` text
- **Client-side JSON-LD** injects `Store` and `Product` schema on storefront pages
- Each store runs on its own subdomain (`slug.shopbanao.in`) or custom domain — fully isolated from `shopbanao.in`

### What's Missing (Gaps)
1. **No fallback SEO defaults** — if AI generation fails or is slow, `meta_title` and `meta_description` stay NULL. Search engines see generic titles.
2. **Store JSON-LD is too basic** — missing `sameAs` (social links), `address`, `openingHours`, `priceRange` fields that Google uses for rich results.
3. **No `ItemList` schema on Shop/Category pages** — Google Shopping and rich snippets need `ItemList` structured data for product listing pages.
4. **Product JSON-LD uses fake reviews** — `aggregateRating` is generated from a hash, not real reviews. Google may penalize this.
5. **No category-level meta tags** — category pages have no unique title/description, hurting category keyword ranking.
6. **Product feed URL uses `storiva.in`** — hardcoded wrong domain in the product feed handler (line 479 of seo-page).

### Implementation

#### 1. Add Fallback SEO Defaults on Store Creation
**File: `src/pages/CreateStore.tsx`**
After the store insert (before AI call), immediately set sensible defaults:
- `meta_title`: `"{Store Name} — Shop Online | Free Delivery"`
- `meta_description`: `"Shop the best products at {Store Name}. ✓ Cash on Delivery ✓ Easy Returns ✓ Fast Shipping"`

These get overwritten if AI succeeds, but guarantee SEO from minute one.

#### 2. Enrich Store JSON-LD Schema
**File: `src/hooks/useJsonLd.ts`**
Enhance `useStoreJsonLd` to include:
- `sameAs` array (Instagram, Facebook URLs)
- `address` with city/state
- `openingHours` from business_hours
- `priceRange` based on product prices
- `potentialAction` SearchAction for site search

#### 3. Add ItemList Schema for Shop & Category Pages
**File: `src/hooks/useJsonLd.ts`**
Add new `useProductListJsonLd` hook that injects `ItemList` schema with product entries (name, url, image, price). Used by StorefrontHome, StorefrontShop, and CategoryDetail pages.

#### 4. Fix Product JSON-LD — Use Real Reviews
**File: `src/hooks/useJsonLd.ts`**
Replace fake hash-based `aggregateRating` with real data from `product_reviews` table. If no reviews exist, omit the `aggregateRating` field entirely (Google guidelines).

#### 5. Add Category-Level Meta Tags
**File: `src/pages/CategoryDetail.tsx`**
Set dynamic `<title>` and `<meta description>` per category:
- Title: `"{Category Name} — {Store Name} | Shop Online"`
- Description: `"Browse {count} products in {Category Name} at {Store Name}. Fast delivery & easy returns."`

#### 6. Fix Product Feed Domain
**File: `supabase/functions/seo-page/index.ts`**
Change line 479 from `storiva.in` → `shopbanao.in`.

---

### Files Changed
| File | Action |
|------|--------|
| `src/pages/CreateStore.tsx` | Edit — add fallback meta defaults |
| `src/hooks/useJsonLd.ts` | Edit — enrich Store schema, add ItemList hook, fix fake reviews |
| `src/pages/StorefrontHome.tsx` | Edit — use ItemList hook |
| `src/pages/StorefrontShop.tsx` | Edit — use ItemList hook |
| `src/pages/CategoryDetail.tsx` | Edit — add meta tags + ItemList |
| `supabase/functions/seo-page/index.ts` | Edit — fix domain |

### No Conflicts with ShopBanao SEO
ShopBanao landing page SEO lives entirely in `index.html` and `LandingJsonLd.tsx`, served only on `shopbanao.in`. Store SEO runs on `{slug}.shopbanao.in` or custom domains — completely separate DNS, separate canonical URLs, separate sitemaps, separate robots.txt. Zero overlap.

