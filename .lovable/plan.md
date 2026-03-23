

# Performance & Scaling Optimization Plan

## Summary
Safe, high-impact optimizations targeting RPC payload size, dashboard query efficiency, and SELECT column pruning. No breaking changes — only tightening existing queries.

---

## What Gets Fixed

### 1. Limit RPC product payload (homepage → 20 products)
The `get_storefront_data` RPC currently defaults to `_product_limit = 50`. The storefront layout calls it with 50. Most homepages display 8–16 products.

**Change:** Reduce the default call in `StorefrontLayout.tsx` from `_product_limit: 50` to `_product_limit: 20`. The Shop page already uses infinite scroll with its own paginated query, so this is safe.

**Impact:** ~60% smaller API response for homepage loads.

### 2. Prune SELECT columns in dashboard queries
`Dashboard.tsx` fetches orders with `select("created_at, total, status, order_items(product_name, quantity, total)")` — this is already good. But `StoreOrders.tsx` uses `select("*, order_items(*)")` loading all columns. `ProductsList.tsx` uses `select("*")`.

**Changes:**
- **StoreOrders.tsx:** Replace `select("*")` with specific columns: `id, order_number, created_at, status, total, currency, customer_name, customer_phone, payment_method, tracking_number, tracking_url, street_address, city, state, pincode, notes, storefront_customer_id, order_items(id, product_name, quantity, unit_price, total, product_id)`
- **ProductsList.tsx:** Replace `select("*")` with: `id, name, slug, image_url, price, sale_price, stock_quantity, is_active, is_best_selling, category, sku, currency, created_at`
- **Dashboard.tsx stats query:** Already uses `head: true` counts — no change needed.

### 3. Add server-side pagination to StoreOrders
Currently fetches up to 1000 orders client-side. Convert to server-side pagination like StoreCustomers already does.

**Changes:**
- Add count query for total orders (with filters applied server-side)
- Use `usePagination` hook + `range(from, to)` 
- Move status filter to server-side `.eq("status", filter)` when active
- Keep search as client-side filter on the current page (search across all orders would need a DB function)

### 4. Add staleTime to dashboard & orders queries
Several queries lack `staleTime`, causing unnecessary refetches on component re-mount.

**Changes:**
- `StoreOrders` queries: add `staleTime: 2 * 60 * 1000` (2 min)
- `ProductsList` queries: add `staleTime: 2 * 60 * 1000`
- `Dashboard` orders analytics: already has 5 min — keep

### 5. Limit Dashboard orders analytics query
Currently fetches 500 orders for chart data. Reduce to last 200 (charts only show monthly aggregates, 200 is plenty).

**Change:** `.limit(500)` → `.limit(200)` in Dashboard.tsx

---

## What We Are NOT Changing (Safe)
- No database schema changes
- No RLS policy changes  
- No edge function changes
- No new tables or migrations
- Connection pooling is managed by Cloud — no action needed
- Image optimization already in place (WebP, lazy loading, srcSet)
- StorefrontShop already uses infinite scroll pagination

---

## Files Modified
1. `src/layouts/StorefrontLayout.tsx` — reduce product limit 50→20
2. `src/pages/StoreOrders.tsx` — server-side pagination + column pruning
3. `src/pages/ProductsList.tsx` — column pruning + staleTime
4. `src/pages/Dashboard.tsx` — reduce analytics limit 500→200

## Risk Assessment
**Low risk.** All changes are query optimizations that reduce data transfer. No UI changes, no new features, no schema modifications.

