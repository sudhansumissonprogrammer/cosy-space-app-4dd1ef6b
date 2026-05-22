## Deep audit findings

### 1. PAGE_SIZE is correct at 50 (do NOT drop to 20)
- Worker hardcodes `PRODUCTS_PAGE_SIZE = 50` in `docs/cloudflare-worker-current.js` (line 2028).
- Worker builds `offset = page * 50` and `limit = 50`.
- If client `useInfiniteProducts.ts` drops to 20 without a Worker redeploy, page 1 client (`offset 20`) calls Worker which fetches `offset 50` → **duplicate + missing rows, broken pagination**.
- Conclusion from my earlier message was wrong. Keeping 50 in both is safe; reducing requires a coordinated Worker deploy you must do manually.

### 2. 🔴 Bug — Shop prefetch in `App.tsx` is dead code (orphan cache key)
- `App.tsx` line ~599 prefetches into key `["storefront-shop-all", storeId]` with PAGE_SIZE=14.
- `StorefrontShop.tsx` reads from key `["shop-all-v3", storeId, "__all__", "default", 50]`.
- Keys never match → prefetched 14 rows sit in cache unused, Shop refetches 50 from Worker anyway.
- **Two queries fire per /shop click. Fix = delete the dead prefetch block (the Worker /api/products is already fast — CF cache + KV).**
- Same orphan-key bug exists for the category prefetch (`["category-products", storeId, cat.name]` vs hook key `["cat-detail-v3", storeId, cat.name, "default", 50]`). Delete that too.

### 3. 🟡 Card image lazy-loading incomplete on Style4, V19, V20
- ✅ Style1/2/3 correct: `loading={priority?"eager":"lazy"}` + `decoding` + `fetchPriority`.
- ⚠️ Style4 (`ProductCardStyle4.tsx` line 91): hardcoded `loading="lazy"` — even first 4 LCP cards lazy-load. Hurts LCP on menu-style storefronts.
- ⚠️ V19/V20 cards: have `loading={priority?...}` but missing `decoding` + `fetchPriority`.

### 4. 🟡 Best Sellers page — no pagination
- `StorefrontBestSellers.tsx` loads full list. Confirm and add 20/page infinite scroll matching Shop pattern.

### 5. Already correctly done (no action)
- Shop/Category infinite scroll with IntersectionObserver — ✅
- `priority={index < 4}` on first 4 cards — ✅
- Lazy-imported VariantPickerDialog — ✅
- `useVariantCount` per card (1 small query each, batched by React Query) — acceptable
- Worker /api/products edge cache (60s CF + KV) — ✅

## Changes to ship

### A. Remove orphaned Shop + Category prefetches in `src/App.tsx`
Delete two prefetch blocks (~Shop block lines ~595–615, Category nested infinite prefetch ~565–585). They write to query keys nothing reads. Net effect: -1 wasted DB query per /shop and /category click; cleaner cache.

### B. Fix `ProductCardStyle4.tsx` priority handling
Change line 91 from hardcoded `loading="lazy"` to:
```tsx
loading={priority ? "eager" : "lazy"}
decoding={priority ? "sync" : "async"}
fetchPriority={priority ? "high" : "low"}
```
Hover image (line 96) stays lazy/low — correct.

### C. Add `decoding` + `fetchPriority` to V19/V20 cards
`V19ProductCard.tsx` and `V20ProductCard.tsx` — extend their existing `loading={priority?...}` attribute with `decoding` and `fetchPriority` matching Style1/2/3 pattern.

### D. Paginate Best Sellers (`StorefrontBestSellers.tsx`)
- Switch from `useStorefrontProducts` filter to `useInfiniteProducts` with `category` filter, or a new infinite query with `.eq("is_best_selling", true).range(...)`.
- PAGE_SIZE 20 (acceptable here because it's a direct Supabase call, not the Worker /api/products path).
- Reuse `ProductCardSkeleton` + IntersectionObserver pattern from `StorefrontShop.tsx`.

### Excluded from this batch (require coordinated changes)
- **Dropping PAGE_SIZE to 20** — needs Worker redeploy in lockstep. Will queue for next session if you want.
- **Routing Shop first page through `get_storefront_data` RPC** (item F from prior analysis) — bigger architecture move, separate session.
- **Variant counts batching** — micro-optimization, low impact.

## Risk

- A: Zero. Removing dead code that never reads back what it writes.
- B/C: Zero. Pure attribute additions on `<img>`; falls back to native browser defaults if anything off.
- D: Low. New query path mirrors proven Shop pattern; behind existing `/best-sellers` route only.

## Files touched
- `src/App.tsx` (delete 2 prefetch blocks)
- `src/components/storefront/ProductCardStyle4.tsx`
- `src/components/storefront/v19/V19ProductCard.tsx`
- `src/components/storefront/v20/V20ProductCard.tsx`
- `src/pages/StorefrontBestSellers.tsx`

No Worker change, no DB migration, no RLS change.
