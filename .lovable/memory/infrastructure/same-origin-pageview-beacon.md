---
name: same-origin-pageview-beacon
description: Worker /__sf/pv route owns the pageview write path; PG page_views is single source of truth
type: feature
---

# Same-origin pageview beacon (worker v8.61.0)

## Source of truth
Supabase `page_views` table. Dashboard analytics read PG. **AE is not used** — `writePageViewAE()` exists in worker but is no longer called (removed in v8.45.0). Safe to delete later.

## Write paths (both target PG)
1. **Worker HTML responses** — `recordPageView()` buffers and bulk-INSERTs on cold/MISS HTML serves. ~1 write per first paint.
2. **Browser SPA navigations** — `usePageviewBeacon` POSTs to `/__sf/pv` (same origin → no DNS/TLS/CORS). Worker handler at `docs/cloudflare-worker-current.js` (search `/__sf/pv`) forwards the full enriched body to PostgREST. Preserves referrer/utm/device/browser/os/landing_path dimensions.

Both paths share the same `_pvDedup` Map (30-min window per `store|visitor|path`), so a worker write and a client beacon for the same nav in the same isolate dedupe naturally.

## Client fallback
`usePageviewBeacon` calls `/__sf/pv` first; on non-2xx or network error falls back to direct PostgREST POST. Safe to deploy code before the worker.

## Worker deploy required
Adding/changing the `/__sf/pv` route requires manual deploy of `docs/cloudflare-worker-current.js`. Until deployed, client falls back to legacy direct PostgREST write — no data loss.
