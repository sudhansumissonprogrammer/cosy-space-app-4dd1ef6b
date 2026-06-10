---
name: worker-edge-cache-for-bestsellers-and-category
description: BestSellers + home CategorySection now use /api/products?best_selling=1 and /api/category for edge cache (Worker v8.52.0)
type: feature
---

# Edge cache routing for BestSellers + home Category sections

**Why:** Both sections previously went direct to Supabase from the storefront
home, adding ~800ms (best-sellers) + ~500ms × N (categories) to cold loads.

**What's in v8.52.0 (manual Worker deploy required):**
- `/api/products` now accepts `?best_selling=1`. Filter is included in cache
  key, KV key, coalesce key, revalidate key, and long-tail KV gating. Same 24h
  KV + 5min browser Cache-Control as default products feed.

**Frontend:**
- `useBestSellingProducts` page 0 → `fetchViaWorker('/api/products?best_selling=1', …)`
  via new `src/lib/workerFetch.ts` helper (sessionStorage cache 15min, falls
  back to direct Supabase on preview/localhost). Pages > 0 still go Supabase.
- Home `CategorySection` in StorefrontHomeV16/V21/V22 calls
  `fetchCategoryEdge(category.slug)` from `src/lib/storefrontEdgeApi.ts` first
  (limit=50 cache key matches prewarm cron), then slices to HOME_CAT_LIMIT=11.
  Falls back to direct Supabase in preview/localhost OR on Worker failure.

**Deploy:** ship `docs/cloudflare-worker-current.js` (v8.52.0) manually.
Existing best_selling=1 URLs return empty until deploy because the Worker
default path will run without the filter — but the frontend fallback handles
preview, and production simply gets default-sorted products (which lead with
is_best_selling.desc anyway) until the new worker is live.
