# Merchant Dashboard Performance Audit & Safe Optimization Plan

## What the data says

Measured from Postgres statement stats + code reading. Storefront traffic is not the problem — the merchant dashboard is.

| Query | Calls | Avg | Worst | Total time |
|---|---|---|---|---|
| order_items + orders join (legacy top-products scan) | 8,853 | 212 ms | 1.85 s | 31 min |
| products list (`products-all`) | 14,760 | 50 ms | 700 ms | 12 min |
| orders list + embedded items | 19,213 | 38 ms | 740 ms | 12 min |

Table sizes: products 25,249 rows / 55 MB, product_images 48k, page_views 109k, storefront_events 102k, uptime_checks 158k.

## Root causes found

1. **Products page loads the whole catalog.** `ProductsList` fetches up to 1,000 rows (15 columns) per visit, then does search, filter, sort and pagination in the browser. For hopknock/wristlife (5k–25k products) this is a multi-MB payload on every mount, and it silently hides products beyond row 1,000.
2. **Dashboard revenue chart fires 12 separate RPCs.** `Dashboard.tsx` calls `get_store_sales_analytics` once per month for 12 months on every dashboard load — 12 round trips and 12 order scans where one query would do.
3. **Orders list over-fetches.** 20 columns + a lateral aggregate of all order items, plus a second `count: estimated` pass, on every filter/search/page change. Name/phone search uses `ilike %...%` with no trigram index (orders has none), so search scans the store's orders.
4. **Legacy order-items scan is the single biggest historical cost.** Top Products already moved to the `get_top_products` RPC; the 212 ms average is mostly accumulated from the old code path plus remaining `select("*, order_items(*)")` call sites (StoreCustomers, admin orders, storefront account).
5. **Fan-out on dashboard mount.** Independent queries from HeroRevenue, TodayInsights, LiveVisitors, PendingActions, StoreChecklist, RecentOrders, TopProducts, wallet, stats + the 12 chart RPCs = ~22 requests before first paint.
6. **Chunk prefetch storm.** `prefetchDashboardRoutes` eagerly imports 20 page chunks after every dashboard mount.

## Plan (staged, each stage independently shippable and reversible)

### Stage 1 — Zero-risk backend wins (no UI change)
- Add `get_store_monthly_sales(_store_id, _months)` RPC returning 12 rows in one pass over `orders` (uses existing `idx_orders_store_created`). Swap the Dashboard chart to it; keep the old per-month path deleted only after the chart renders identical numbers.
- Add trigram indexes for orders search: `orders (customer_name gin_trgm_ops)`, `orders (customer_phone gin_trgm_ops)` — pure additions, no query change needed, `ilike` picks them up.
- Add `get_products_page(...)` RPC (store-scoped, security definer with owner/admin check) returning filtered + sorted + paged rows and a total count in one call.

### Stage 2 — Products page server-side paging (behind a flag)
- Point `ProductsList` at `get_products_page` for search/status/stock/category/sort/page, with a 300 ms debounce on the search box.
- Keep the current client-side path in place behind a `?legacyList=1` escape hatch for one release so any regression can be compared side by side.
- Result: constant ~20-row payload instead of 1,000 rows; products beyond row 1,000 become reachable for the first time.

### Stage 3 — Orders list slimming
- Drop the embedded `order_items` from the list query; fetch items only when a row/sheet is expanded (already how the detail sheet reads). Show item count from a cheap aggregate column or the existing detail fetch.
- Replace `count: "estimated"` with a count only on page 1, reused for subsequent pages within the same filter set.
- Keep the optimistic-update logic untouched; only the selected columns change.

### Stage 4 — Mount fan-out reduction
- Merge PendingActions + StoreChecklist + stat-card counts into the existing `get_dashboard_stats` RPC (one call instead of five head-counts).
- Raise `staleTime` on slow-moving panels (checklist, wallet, top products) to 10 min and keep realtime invalidation as the freshness trigger — realtime already pushes order/stock changes.
- Trim `prefetchDashboardRoutes` to the 6 most-visited pages and start it on first idle after paint.

### Stage 5 — Remaining `select("*")` cleanups
- `StoreCustomers` customer-orders, admin orders, storefront account: replace `*, order_items(*)` with explicit column lists.

## Safety rules for this work
- No schema changes to existing columns; only new indexes and new RPCs. Nothing is dropped.
- Every new DB function is created with an explicit `DROP FUNCTION IF EXISTS <old signature>` guard per the project's overload rule, plus `GRANT EXECUTE ... TO authenticated`.
- One stage per deploy, verified against a large store (hopknock, ~5.8k products) and a small one (serdiyajewels) before moving on.
- Verification per stage: row counts and totals compared old vs new, `EXPLAIN (ANALYZE, BUFFERS)` on the new queries, and a browser pass through Products, Orders, Customers, and the Dashboard.
- Rollback: each stage is a self-contained edit; reverting the page file restores the previous behaviour because the old indexes/RPCs stay in place.

## Expected outcome
- Dashboard first paint: ~22 requests → ~8; revenue chart 12 RPCs → 1.
- Products page payload: up to several MB → ~40 KB per page, and correctness fix for catalogs over 1,000 items.
- Orders list: ~40 % less time per call once the item aggregate is removed; search becomes index-backed instead of a scan.
- Headroom: removes the dashboard as the top DB consumer, so the same compute tier serves noticeably more concurrent merchants and shoppers.
