# Accurate analytics (Today / Yesterday / 7d / 30d) + dashboard parity

Goal: dashboard home and analytics page show the **same numbers** for the same period, every "Orders" count excludes `pending` & `cancelled`, and we add **Today / Yesterday** ranges plus sessions, unique visitors and conversion on the dashboard home.

## 1. Database — fix order count in `get_dashboard_stats`

Migration: rewrite the RPC so `total_orders` only counts revenue-bearing statuses (same set used everywhere else in the app).

```sql
-- statuses kept consistent across UI: confirmed, shipped, delivered, partially_paid
SELECT COUNT(*) INTO _total_orders
FROM orders
WHERE store_id = _store_id
  AND status IN ('confirmed','shipped','delivered','partially_paid');
```

Also exclude bot pageviews from `total_views`:
```sql
SELECT COUNT(*) FROM page_views WHERE store_id = _store_id AND is_bot = false;
```

## 2. StoreAnalytics page — add Today / Yesterday + bugfixes

File: `src/pages/StoreAnalytics.tsx`

- Add `"today" | "yesterday"` to the `DateRange` union and two new TabsTriggers ("Today", "Yesterday") before "7 days". Grid becomes `grid-cols-7`.
- Compute `rangeStart` / `rangeEnd` / `priorStart` / `priorEnd` for the new buckets:
  - **today**: start = startOfDay(now), end = now, prior = yesterday full day.
  - **yesterday**: start/end = full prior day; prior = the day before.
- Replace the current `isAfter(d, rangeStart)` filters with an inclusive `[rangeStart, rangeEnd]` range so single-day buckets work (today's 00:00 row must be included). Apply same fix to `filtered.prior` and `filteredViews`.
- **Sessions prior-period bug**: when range > 30d the rollup is added to `current` but `prior` only uses raw rows (which are empty older than 30d), so % change is wrong. Add a `rollupSessions(priorStart, rangeStart)` term to `priorSessions` using the same `page_views_daily` source.
- Add **Unique Visitors** metric card (distinct `visitor_id`, raw + `visitors` column from rollup) alongside Sessions / Conversion. Same raw+rollup merge pattern.

## 3. Dashboard home — Today Summary with sessions / visitors / conversion + CTA

File: `src/pages/Dashboard.tsx` (and a small new component `src/components/dashboard/TodayInsights.tsx`).

- New card "Today" that shows 4 tiles: **Orders**, **Revenue**, **Sessions**, **Conversion %**, plus a small secondary line for **Unique Visitors**. All numbers filtered to `created_at >= startOfDay(now)`, `is_bot=false`, status in revenue set.
- Single React Query keyed `["today-insights", storeId]`, parallel fetches:
  - `orders` (today, revenue statuses) → orders, revenue
  - `page_views` (today, is_bot=false) → distinct `session_id` and distinct `visitor_id`
  - conversion = orders / sessions × 100
- Add a **"View detailed analytics →"** button at the card footer that calls `navigate(`/dashboard/stores/${storeSlug}/analytics`)`.
- Mount this component on the Dashboard right under `HeroRevenue`, replacing the existing `TodaySummary` (which only shows orders/revenue/customers) so we don't duplicate.

## 4. Sitewide order-count audit (verify, no changes needed where already correct)

Already correct (revenue statuses applied): `HeroRevenue.tsx`, `TodaySummary.tsx`, Dashboard `ordersData`, `StoreAnalytics.tsx`.

Will be corrected by the RPC change in step 1: Dashboard "Orders" stat card (uses `stats.total_orders`).

Out of scope (operational lists, not analytics): `StoreOrders.tsx`, `AdminOrders.tsx`, `RecentOrders.tsx` — these correctly show all orders including pending so the merchant can act on them.

## Technical notes

- All new date math uses `date-fns` (`startOfDay`, `endOfDay`, `subDays`) — already imported.
- Sessions still use `session_id` (30-min sliding window) per the existing `visitorSession.ts` contract.
- `page_views_daily` rollup is the source of truth for any day older than 30 days; raw `page_views` covers the last 30 days. The today/yesterday tabs always land in the raw window so they get exact counts.
- No worker changes required.
- No edge function changes required.

## Verification checklist

- Today tab: numbers match the Dashboard "Today" card exactly.
- 7d/30d Orders count equals `COUNT(orders WHERE status IN revenue set)` in that range.
- Dashboard stat card "Orders" no longer includes pending.
- Conversion = Orders / Sessions for the selected range (both pages).
- Unique Visitors ≤ Sessions in every range.
