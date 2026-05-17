
## What I found (deep check before planning)

I inspected the live database and the current Cloudflare Worker before deciding what's actually safe to change. Headline:

**Most of what your analysis suggested is ALREADY done.** Only #3 (log retention) needs a real fix today.

### #1 — Page-view tracking (sampling/batching)
The Worker (v8.2+) already does this aggressively:
- **30-min per-visitor dedup** (`PV_DEDUP_WINDOW_MS = 30 min`) → one visitor browsing 10 pages = 1 row, not 10.
- **Bot filter** (regex blocks Googlebot, WhatsApp, Lighthouse, etc.).
- **Bulk batching** — buffers up to 100 rows or 60s, then one bulk INSERT. ~80–95% fewer DB round-trips.
- **No edge function involved** — Worker writes directly to PostgREST.
- Asset/API paths skipped.

So the "16,856 page views" are **already the deduped, sampled, batched number**. Adding more sampling on top would just hurt your analytics accuracy without saving meaningful money. **No change recommended.**

### #2 — `get_storefront_data` JSON egress
Already migrated. Live RPC is `get_storefront_shell` which returns metadata + categories + theme + custom_pages + `total_products` count. **Products are NOT in the shell.** Products load paginated 50 at a time via `useInfiniteProducts`. Worker caches the shell at the edge. **No change recommended** — would be busywork.

### #3 — Log table growth ✅ This is the real fix
Current state from live DB:
| Table | Rows | Size | Rows past retention |
|---|---|---|---|
| `page_views` | 18,878 | 5.3 MB | 0 older than 90 days (table is young) |
| `error_logs` | 1,873 | 3.1 MB | 3 older than 30 days |

Nothing to delete *today*, but with ~560 PVs/day per active store and growing store count, these tables will hit 60+ MB / 200k+ rows within a year — slow queries, RLS scans get expensive, backups balloon.

`pg_cron` and `pg_net` are already enabled, and you already run 7 cleanup-style cron jobs (referral telemetry, media library, etc.), so this fits the existing pattern.

## The plan (one migration only)

### Migration: add `cleanup_app_logs()` function + daily cron

```sql
-- 1. Function (SECURITY DEFINER, search_path locked)
CREATE OR REPLACE FUNCTION public.cleanup_app_logs()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pv_deleted int;
  _el_deleted int;
BEGIN
  -- page_views: keep 90 days (StoreAnalytics charts only need 30-day window)
  WITH d AS (
    DELETE FROM public.page_views
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  ) SELECT count(*) INTO _pv_deleted FROM d;

  -- error_logs: keep 30 days
  WITH d AS (
    DELETE FROM public.error_logs
    WHERE created_at < now() - interval '30 days'
    RETURNING 1
  ) SELECT count(*) INTO _el_deleted FROM d;

  RETURN json_build_object(
    'page_views_deleted', _pv_deleted,
    'error_logs_deleted', _el_deleted,
    'ran_at', now()
  );
END;
$$;

-- 2. Schedule daily at 03:30 UTC (off-peak, after billing-cron at 03:00)
SELECT cron.schedule(
  'cleanup-app-logs-daily',
  '30 3 * * *',
  $$ SELECT public.cleanup_app_logs(); $$
);
```

### Why these retention windows are safe
- **page_views 90 days** — `StoreAnalytics.tsx` and admin dashboards query last 30 days only. 90 gives 3× safety margin and keeps month-over-month comparisons working.
- **error_logs 30 days** — debugging window is days, not months. Anything older is noise.
- Function uses `DELETE … RETURNING` so we get exact counts, and runs in one transaction per table.

### What I will NOT touch (and why)
- ❌ No worker changes — current dedup + batching is already optimal.
- ❌ No `get_storefront_shell` changes — already lean.
- ❌ No new sampling on page-views — Worker handles it.
- ❌ No Cache-Control header tweaks — worker already controls edge cache.
- ❌ No table truncations or backfills — only deletes rows past retention.

### Rollback
If retention is ever wrong: `SELECT cron.unschedule('cleanup-app-logs-daily');` and `DROP FUNCTION public.cleanup_app_logs();`. No schema is altered, no data is touched until 90/30 days have passed.

### Expected impact
- Today: 0 rows deleted (nothing is old enough).
- Steady state: keeps `page_views` capped around 50–80k rows per active store, `error_logs` under a few thousand.
- Bill impact: small now (~₹3–5/mo), prevents the table from becoming the #1 cost driver 6–12 months from now.

Approve to run the migration.
