# Analytics Overhaul — Safe, Phased Rollout

Goal: make analytics IST-accurate, richer (referrer/UTM/geo/device), funnel-aware, cohort-aware, real-time, and surface Cloudflare AE data — without breaking the live dashboard or storefronts.

Guiding rules:
- Every schema change is **additive** (new columns nullable, new tables independent). No drops, no renames.
- Every new column has a default so existing inserts keep working.
- Dashboard reads gracefully degrade when new columns are empty (so old rollups still show).
- Each phase ships independently and can be reverted by feature-flag/env.

---

## Phase 1 — Foundations (schema + ingestion plumbing)

### 1.1 Timezone-aware rollup (IST)
- Add `stores.timezone TEXT DEFAULT 'Asia/Kolkata'` (nullable, safe).
- Replace `rollup_page_views_daily()` so the day bucket is computed in each store's timezone: `(created_at AT TIME ZONE store.timezone)::date`.
- Keep the old function signature (DROP-FIRST rule from memory) — same name, same args, smarter body.
- Backfill: re-run rollup for last 90 days using new TZ-aware logic. Rollup is idempotent (UPSERT), so safe to re-run.
- Dashboard: compute `todayStart` / `rangeStart` using `store.timezone` instead of browser local.

### 1.2 Enrich `page_views` with new dimensions
Add nullable columns (no default needed beyond NULL):
- `referrer TEXT`
- `utm_source TEXT`, `utm_medium TEXT`, `utm_campaign TEXT`, `utm_term TEXT`, `utm_content TEXT`
- `country TEXT` (2-letter from `cf-ipcountry`)
- `device TEXT` (mobile/tablet/desktop), `browser TEXT`, `os TEXT`
- `landing_path TEXT` (first path of session)

Update beacon (`usePageviewBeacon`) to capture: `document.referrer`, URL UTM params, UA-derived device/browser/os.
Old rows stay NULL — dashboard handles that.

### 1.3 Funnel events table
New table `storefront_events`:
```
id, store_id, session_id, visitor_id, event_name,
product_id NULL, value NUMERIC NULL, currency TEXT NULL,
path TEXT, created_at, metadata JSONB
```
Events: `view_product`, `add_to_cart`, `begin_checkout`, `purchase`.
- RLS: store owner + admin read; public anon insert (rate-limited by edge).
- Indexes: `(store_id, created_at desc)`, `(store_id, event_name, created_at)`.
- Daily rollup mirror `storefront_events_daily` (store_id, date, event_name, count, value_sum) — populated by the same nightly cron.

### 1.4 Fire events from existing code (no UI change)
- `ProductDetail` mount → `view_product`
- `CartContext.addItem` → `add_to_cart`
- `CheckoutPage` mount → `begin_checkout`
- Order success → `purchase` (with order total)

All fire-and-forget, wrapped in try/catch — never block UX.

---

## Phase 2 — Rollups + maintenance

### 2.1 Extended rollup columns
Add to `page_views_daily`:
- `bounce_sessions INT DEFAULT 0`
- `total_session_duration_seconds BIGINT DEFAULT 0`
- `pageviews_per_session NUMERIC` (computed in dashboard from existing fields)

Update `rollup_page_views_daily()` to compute:
- bounce_sessions = sessions with exactly 1 pageview that day
- session duration = max(created_at) - min(created_at) per session, summed

### 2.2 Cohort table
New table `customer_cohorts_monthly` (store_id, cohort_month DATE, period_offset INT, customers INT, returning_customers INT, revenue NUMERIC). Populated by nightly cron from `customers` + `orders`. Read-only for dashboard.

### 2.3 Cron upgrades
Update existing `rollup-page-views-daily` cron to also:
- Roll up `storefront_events_daily`
- Recompute `customer_cohorts_monthly` for last 13 months
Still 00:15 UTC, idempotent.

---

## Phase 3 — Dashboard improvements (StoreAnalytics.tsx)

### 3.1 Performance fix
- Cap `analytics-orders` query with `.gte("created_at", rangeStart)` and re-query on range change. Use range-scoped queryKey.
- Same for `analytics-views` (already 30d capped — keep, but key by range).

### 3.2 New metric cards
Row 2: Bounce Rate · Pages/Session · Avg Session Duration · Returning Visitor %

### 3.3 New charts (collapsible sections)
- **Traffic Sources** — pie of `utm_source` + "Direct" + "Organic" + "Referral" (derived from referrer host)
- **Geography** — bar of top 10 countries
- **Devices** — donut mobile/desktop/tablet
- **Funnel** — view → cart → checkout → purchase, with drop-off %
- **Cohort retention** — heatmap (rows = signup month, cols = months since)

### 3.4 Live visitors widget
- Card at top showing "🟢 N visitors right now (last 5 min)".
- Polls `page_views` filtered by last 5 minutes every 15s. Light query, indexed.

### 3.5 Cloudflare AE surface
- New edge function `analytics-ae-query` that reads from CF Analytics Engine using the AE SQL API.
- Returns: edge cache HIT rate, requests by country (CF-side, more accurate than beacon), bot vs human ratio.
- Dashboard adds an "Edge analytics" card section. Falls back to a small "AE not configured" notice if the secret is missing.

---

## Phase 4 — Admin analytics (small, optional)

- Add to `get_admin_analytics`: active vs inactive stores, top 10 stores by revenue, plan distribution, MRR.
- AdminAnalytics page gets 4 extra cards. No new tables.

---

## Safety & rollback

- All migrations are additive — rolling back = stop writing to new columns; dashboard still works using existing data.
- Funnel events fire fire-and-forget; if the table is missing the storefront still works.
- Live visitor widget guarded by error boundary; if query fails, widget hides itself.
- AE widget is opt-in via `CF_AE_API_TOKEN` secret — absent = hidden.

---

## Technical details

**Migrations (one per phase, in order):**
1. `add_timezone_and_pv_dimensions` — `stores.timezone`, page_views new columns, rewrite rollup function (DROP-FIRST), backfill 90d.
2. `create_storefront_events` — table + RLS + grants + indexes.
3. `extend_page_views_daily` — bounce/duration columns, rewrite rollup, backfill.
4. `create_customer_cohorts_monthly` + rollup function.
5. `update_cron_rollup` — extend nightly cron body (insert via supabase--insert, not migration, since it contains keys).

**Edge functions:**
- New: `analytics-ae-query` (reads Cloudflare AE).
- Existing `ingest` untouched (already a no-op for AE pageviews).

**Frontend files touched:**
- `src/hooks/usePageviewBeacon.ts` — capture referrer/UTM/device
- `src/lib/storefrontEvents.ts` (new) — fireEvent helper
- `src/pages/ProductDetail.tsx`, `src/contexts/CartContext.tsx`, `src/pages/CheckoutPage.tsx`, order-success spots — fire 4 events
- `src/pages/StoreAnalytics.tsx` — new cards, charts, live widget, AE section
- `src/pages/admin/AdminAnalytics.tsx` — admin extras
- `supabase/functions/analytics-ae-query/index.ts` — new

**Worker:** no changes required. AE data already collected.

**Secrets needed (will request when we hit Phase 3.5):**
- `CF_ACCOUNT_ID`, `CF_AE_API_TOKEN` for AE SQL API.

**Ship order:** Phase 1 → verify dashboard unchanged → Phase 2 → verify rollups → Phase 3 → Phase 4. Each phase is its own implement loop.
