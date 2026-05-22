## Goal
Make every storefront product grid load **20 products per page** (Shop, Category, Home, Best Sellers, V14, V16). Coordinate Cloudflare Worker so pagination offsets stay aligned.

## Current state (audit)

| Surface | File | Current | Target |
|---|---|---|---|
| Shop page | `src/hooks/useInfiniteProducts.ts` | **50** | 20 |
| Category page | uses `useInfiniteProducts` | **50** | 20 |
| Home grid (default + V14) | `src/hooks/useStorefrontProducts.ts` | **14** | 20 |
| Home V16 grid | `src/pages/StorefrontHomeV16.tsx` (`BATCH_SIZE`) | **12** | 20 |
| Best-seller carousel (home) | `src/hooks/useBestSellingProducts.ts` | **12** | 20 |
| Best Sellers full page | `src/pages/StorefrontBestSellers.tsx` | **20** ✅ | — |
| Worker `/api/products` | `docs/cloudflare-worker-current.js` (`PRODUCTS_PAGE_SIZE`) | **50** | 20 |
| Worker inline `__PRODUCTS_INLINE__` | same file | first 50 | first 20 |

**Not changing** (intentional):
- `ProductDetail.tsx` related-products `limit(50)` — discovery list, not paged.
- `bot-render` `limit(50)` — one-shot SEO render for crawlers.
- V19/V20 ProductDetail `limit(20)` — already 20.
- Dashboard pages (Leads, Media, Best Seller mgmt, Carts) — already 20.

## Why Worker must change in lockstep

`useInfiniteProducts` requests page N from `/api/products?page=N`. The Worker computes `offset = page * PRODUCTS_PAGE_SIZE`. If client uses 20 but Worker uses 50, page 2 returns products 50–99 instead of 20–39 → duplicate/missing rows on Shop and Category.

The Worker also inlines the first page of products into the storefront HTML (`window.__PRODUCTS_INLINE__`) and the Shop/Category hooks seed React Query with that inline slice. Inline size must equal the new page size so the next infinite-scroll fetch starts at the correct offset.

## Changes

### 1. Client (5 files — one constant each)
- `src/hooks/useInfiniteProducts.ts` → `PAGE_SIZE = 20`
- `src/hooks/useStorefrontProducts.ts` → `PAGE_SIZE = 20`
- `src/hooks/useBestSellingProducts.ts` → `BEST_SELLER_PAGE_SIZE = 20`
- `src/pages/StorefrontHomeV16.tsx` → `BATCH_SIZE = 20`
- (Verify `StorefrontBestSellers.tsx` — already 20, no change)

### 2. Worker (`docs/cloudflare-worker-current.js`)
- Bump `PRODUCTS_PAGE_SIZE = 20` (line 2028).
- Bump version to `v8.34.0` and update header comment.
- No other logic changes — inline + `/api/products` route both derive from this constant.

### 3. Cache invalidation (post-deploy)
- After Worker deploys, run **`/api/purge-store`** for active stores (or wait 24 h KV TTL). Old cached 50-item responses must clear so the new 20-item shape becomes authoritative.

## Risks & mitigation

| Risk | Mitigation |
|---|---|
| Worker not deployed → client/worker mismatch breaks pagination | Land code + Worker file in the same commit. Remind user to deploy Worker before merging client. |
| Stale CF cache serves old 50-item page after deploy | Purge KV + edge cache via existing `/api/purge-store` route. |
| More fetches per scroll (20 vs 50 = 2.5× requests) | Acceptable — each fetch is edge-cached (≥90% HIT), so origin load is unchanged. UX feels faster (smaller payloads, quicker first paint). |
| Home V14 / Home grid showed 14 items before — visual layout may have row count assumptions | 20 is a clean multiple of 2/4/5 columns, so grid still aligns. |

## Deploy order
1. Merge client + Worker file changes together.
2. User deploys Worker (`wrangler deploy` / dashboard).
3. Hit `/api/purge-store` for the busiest 2–3 stores to clear stale cache.
4. Verify on `serdiyajewellers.shop`: Shop page should load 20, "Load more" should fetch the next 20 starting at offset 20.

## Expected benefit
- 60% smaller first-page payload (20 rows vs 50) → faster TTFB and lower CDN bandwidth.
- Same Supabase egress (cache hit rate already 90%+, more requests just split the same data).
- Consistent page size across every storefront surface → predictable UX, easier debugging.