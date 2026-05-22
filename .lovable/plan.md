## Goal

Push Shop/Category first-page reads through the Worker edge cache so cold loads stop hitting PostgREST. Today `/api/products` returns JSON but **without** the `s-maxage` / `cf-cache-status` / `x-edge-source` headers — Cloudflare's edge can't cache it, so every Shop visit runs the Worker + Supabase. Goal: lift cache hit rate from ~0% to ~90% on Shop, mirroring what Category already does.

## Scope

Storefront list views only: `/shop` and `/category/:slug`. PDP, cart, checkout untouched.

## Changes

1. **DB — `get_shop_page` RPC** (new)
   - `get_shop_page(_store_slug text, _limit int default 50) returns json`
   - Returns `{ store_id, products: [...], total }` using the same column set and ordering as `_fetchProductsFromDb` (display_order, is_best_selling, created_at, id).
   - `STABLE SECURITY DEFINER`, `search_path = public`. Single function, no overloads — follow DROP-FIRST rule from the overload-safety memory.

2. **Worker — `/api/shop` endpoint + inline injection**
   - Mirror `handleCategoryApi`: KV `shop:v{ver}:{domain}:l50`, Cache API 5 min, KV 24 h, version-keyed under existing `pv:{domain}` counter (so `/api/purge-store` invalidates it too).
   - Inject `window.__SHOP_INLINE__` into the SSR HTML when `pathname === "/shop"` (analogous to `__CATEGORY_INLINE__`). Resolve from cache/KV only — no DB hit in the critical render path.
   - **Fix `/api/products` headers**: ensure every return path (`cache-api`, `kv`, `origin`, `origin-coalesced`, fallback) goes through `buildProductResponse` / sets `Content-Type: application/json`, `Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=86400`, `Vary: Accept-Encoding`, and the `x-edge-source` header. The current production response is missing these — that's why CF won't cache it.

3. **Client**
   - `src/lib/storefrontEdgeApi.ts`: add `fetchShopEdge(limit=50)` → `GET /api/shop?limit=50`.
   - `src/hooks/useInfiniteProducts.ts` (page 0, no filter, no sort branch only):
     1. Reuse `window.__SHOP_INLINE__` if present.
     2. Else `fetchShopEdge()`.
     3. Else current `/api/products` path (unchanged).
   - `src/pages/StorefrontShop.tsx`: no UI change. Hook handles the new path.
   - Category: no change — already uses `fetchCategoryEdge` + `__CATEGORY_INLINE__`.

## Safety

- Additive only. New RPC + new Worker route. Existing `/api/products` keeps working; we only fix its response headers.
- Page 0 inline reuse already exists for the home; this extends the same pattern to `/shop`. No new schema columns, no RLS changes.
- Worker uses the same `pv:{domain}` version key, so existing purge flow invalidates Shop automatically.
- Preview/localhost paths fall back to direct Supabase via existing `isProductionHost` guard.
- Manual Worker deploy required (per Core rule): I'll update `docs/cloudflare-worker-current.js`; user deploys.

## Expected impact

- Shop first-page Supabase egress: ~90% reduction (KV 24 h hit rate, same as Category today).
- Worker requests for Shop: ~25% reduction from `__SHOP_INLINE__` reuse on `/shop` direct loads.
- `/api/products` becomes CF-edge-cacheable for the long-tail filtered combos.

## Out of scope

- Changing `PAGE_SIZE` (stays 50 to match Worker key).
- Server-side pagination for Abandoned Carts, Best Seller, etc.
- `product_images` denormalization (deferred — high blast radius).
