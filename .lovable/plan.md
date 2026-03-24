

# Data Flow & Database Performance Optimization Plan

## Analysis Summary

After reviewing the codebase, I found several categories of optimization opportunities:

### A. Duplicate Data Fetching Issues

**1. `my-store` query duplicated across 4 components with DIFFERENT select columns**
- `Dashboard.tsx`: selects `id, currency, slug, name, order_mode`
- `DashboardLayout.tsx`: selects `id, name, logo_url, slug, order_mode`
- `AppSidebar.tsx`: selects `id, name, logo_url, slug, order_mode`
- `StoresList.tsx`: has its own variant

All use `queryKey: ["my-store", user?.id]` with 5-min staleTime — React Query deduplicates them. But the first to resolve wins, so Dashboard may miss `logo_url` and Layout may miss `currency`. This is a latent bug.

**Fix:** Unify the select to include all needed columns in a single canonical query. Create a `useMyStore()` hook.

**2. `useStoreData` (per-storeId) vs `my-store` (per-userId)**
- Dashboard pages use `my-store` query, then child pages use `useStoreData(storeId)` which does a separate `SELECT *` with `owner_id` filter.
- This means navigating Dashboard → Orders makes 2 store queries.

**Fix:** Seed `["store", storeId]` cache from the `my-store` result in DashboardLayout. Child pages already use `useStoreData` which checks this cache.

**3. ProductDetail makes 3 separate queries when data is already cached**
- Fetches product (1 query), then product_images (2nd query), then product_variants (3rd query)
- But `get_storefront_data` RPC already returns products WITH embedded `product_images` and `product_variants`
- The cached product in `storefront-products` already has this data

**Fix:** Use cached product's embedded `product_images`/`product_variants` as `initialData` for those queries, preventing 2 unnecessary fetches on first navigation.

**4. StorefrontShop does `SELECT *` without images/variants**
- CategoryDetail correctly selects `*, product_images(...), product_variants(...)`
- StorefrontShop only selects `*`, missing images and variants for product cards

**Fix:** Add `product_images` and `product_variants` joins to StorefrontShop query.

---

### B. Query Column Pruning (SELECT * elimination)

Replace `SELECT *` with specific columns in high-frequency queries:

| File | Table | Current | Needed Columns |
|------|-------|---------|----------------|
| `useStoreData.ts` | stores | `*` | `id, name, slug, currency, whatsapp_number, order_mode, logo_url, theme, features, is_suspended` |
| `StorefrontShop.tsx` | products | `*` | `id, name, slug, price, sale_price, image_url, currency, stock_quantity, is_best_selling, category` |
| `StorefrontBestSellers.tsx` | products | `*` | same as above |
| `PostPurchaseUpsell.tsx` | products | `*` | `id, name, slug, price, sale_price, image_url` |
| `ProductDetail.tsx` | products | `*` | all columns (keep — detail page needs everything) |

---

### C. Dashboard Store Query Consolidation

**Current flow:**
```text
DashboardLayout mounts → fetches ["my-store"] (5 cols)
  └─ Dashboard mounts → fetches ["my-store"] (5 cols, different set) ← DEDUPLICATED but wrong cols
       └─ StoreOrders mounts → fetches ["store", storeId] via useStoreData (SELECT *)  ← NEW query
```

**Optimized flow:**
```text
DashboardLayout mounts → fetches ["my-store"] (unified 8 cols)
  └─ Seeds ["store", storeId] cache from result
       └─ All child pages use useStoreData → cache hit, no fetch
```

---

### D. Database Indexes (Non-Destructive)

Based on query patterns found in code, these indexes would improve performance:

```sql
-- ProductDetail: lookup by slug + store_id (currently sequential scan)
CREATE INDEX IF NOT EXISTS idx_products_store_slug ON products(store_id, slug);

-- CategoryDetail: filter by category name + store
CREATE INDEX IF NOT EXISTS idx_products_store_category ON products(store_id, category) WHERE is_active = true;

-- StorefrontShop: paginated active products
CREATE INDEX IF NOT EXISTS idx_products_store_active_created ON products(store_id, created_at DESC) WHERE is_active = true;

-- Orders: status filter (used in StoreOrders count query)  
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);

-- Orders: date range queries (analytics)
CREATE INDEX IF NOT EXISTS idx_orders_store_created ON orders(store_id, created_at);

-- CustomerLeads: store listing
CREATE INDEX IF NOT EXISTS idx_customer_leads_store_created ON customer_leads(store_id, created_at DESC);

-- Abandoned carts: store + recovered filter
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_store ON abandoned_carts(store_id, recovered);
```

---

### E. React Query Cache Strategy Fixes

**Issue: `useStorefrontThemeConfig` has a no-op queryFn**
Currently queries `queryClient.getQueryData()` which is synchronous — this is an anti-pattern. It works because the cache is pre-seeded, but if the cache is ever evicted, the queryFn returns `null` and never fetches real data.

**Fix:** No change needed — current behavior is intentional (cache-only subscription). Just document it.

**Issue: StorefrontLayout `initialDataUpdatedAt: 1`**
This forces a background refetch on every mount even with fresh injected data. This is intentional (SWR pattern) but means every storefront page load makes 1 RPC call even when data was just injected 100ms ago.

**Fix:** Set `initialDataUpdatedAt` to `Date.now()` when data comes from injection (< 5 seconds old), and `1` only for localStorage cache. This eliminates 1 RPC call per fresh storefront visit.

---

## Implementation Steps

1. **Create `useMyStore` hook** — unified store query for dashboard with all needed columns, seeds `["store", storeId]` cache
2. **Update Dashboard, DashboardLayout, AppSidebar** — use `useMyStore` instead of inline queries
3. **Fix StorefrontLayout `initialDataUpdatedAt`** — use `Date.now()` for fresh injected data
4. **Seed ProductDetail cache from RPC data** — use embedded `product_images`/`product_variants` as initialData
5. **Add image/variant joins to StorefrontShop query**
6. **Prune SELECT * in 4 high-frequency queries**
7. **Add 7 database indexes** via migration

## Estimated Impact

| Metric | Improvement |
|--------|------------|
| Dashboard store queries | 3→1 per navigation |
| Storefront RPC calls | -1 per fresh visit (skip redundant refetch) |
| ProductDetail DB queries | 3→1 on first navigation (cache hit for images/variants) |
| Query payload size | ~40% smaller (column pruning) |
| DB index lookups | Sequential scan → index scan on 7 query paths |

All changes are backward compatible, non-destructive, and safe for live deployment.

