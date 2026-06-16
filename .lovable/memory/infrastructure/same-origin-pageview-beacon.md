---
name: same-origin-pageview-beacon
description: Browser beacon + ingest function own pageview writes; PG page_views is single source of truth
type: feature
---

# Pageview beacon pipeline (v8.63.0)

## Source of truth
Supabase `page_views` table. Dashboard analytics read PG. **AE is not used** — `writePageViewAE()` exists in worker but is no longer called (removed in v8.45.0). Safe to delete later.

## Write path
**Browser storefront navigations** — `usePageviewBeacon` sends directly to edge function `ingest` using `navigator.sendBeacon()` first, then a delayed `fetch(..., keepalive: true)` safety net. This is required for FB/Google in-app ad clicks that bounce in under 1s. The ingest function writes to `page_views` and preserves referrer/utm/device/browser/os/landing_path dimensions.

The ingest function dedupes `store_id + IP + path` for 30s, so sendBeacon + fetch safety net should not double count the same ad landing.

Worker PG writes are disabled (`PV_WRITE_SUPABASE = false`) to avoid double writes across independent worker/function isolates. Worker may still write Analytics Engine for long-term edge telemetry, but dashboard analytics read `page_views`.

## Client fallback
If ingest is unavailable or returns non-204, `usePageviewBeacon` falls back to direct PostgREST insert.

## Worker deploy required
Adding/changing the `/__sf/pv` route requires manual deploy of `docs/cloudflare-worker-current.js`. Until deployed, client falls back to legacy direct PostgREST write — no data loss.
