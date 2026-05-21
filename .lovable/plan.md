# Phase 1 — Move page_views to Cloudflare Analytics Engine

Goal: stop writing pageviews to Supabase entirely. Worker writes directly to Cloudflare Analytics Engine (AE). Zero Supabase invocations, zero DB rows, zero Network egress for pageviews. Free at current + 10× scale.

## What changes

1. **Cloudflare Worker** writes pageviews to AE instead of bulk-inserting into Supabase `page_views`.
2. **Dual-write rollout**: for one week the Worker writes to BOTH AE and Supabase so we can compare counts and verify AE before flipping the switch.
3. **Read path** (`StoreAnalytics.tsx`, admin dashboards) keeps reading from `page_views` for now — Phase 3 swaps it to AE.
4. **Supabase ingest function**: its `?type=view` handler becomes a 204 no-op (kept alive only for `?type=error` until Phase 2).

## Rollout in 3 stages

```text
Stage A (today)   Worker → AE + Supabase   read from Supabase     [verify counts match]
Stage B (+7 days) Worker → AE only         read from Supabase     [stop DB writes]
Stage C (Phase 3) Worker → AE only         read from AE           [delete page_views]
```

## Technical details

### AE dataset schema

```text
binding:  AE_PAGEVIEWS
dataset:  shopbanao_pageviews
indexes:  [store_id]                                  # partition key
blobs:    [path, visitor_id, country, device, referrer, host]
doubles:  [1]                                          # unit count
```

### Worker changes (`docs/cloudflare-worker-current.js`)

- Add `writePageViewAE(env, request, storeId, pathname)` helper.
- In `recordPageView()`: after dedupe passes, call AE write first, then push to existing Supabase buffer (Stage A) or skip the buffer entirely (Stage B, gated by a `PV_WRITE_SUPABASE` constant we flip).
- AE write is synchronous in-isolate (zero latency, no fetch) — no `ctx.waitUntil` needed.
- Bump version banner to `v8.30.0-ae-pageviews`.

### Wrangler binding (user adds in Cloudflare dashboard, not code)

```toml
[[analytics_engine_datasets]]
binding = "AE_PAGEVIEWS"
dataset = "shopbanao_pageviews"
```

### Frontend

- `supabase/functions/ingest/index.ts`: `handleView()` returns `204` immediately. Comment that pageview tracking moved to Worker AE.
- No frontend code changes needed — pageviews are already recorded by the Worker on HTML response, not by the SPA.
- `StoreAnalytics.tsx` and `AdminUsageMonitoring.tsx` unchanged (still read `page_views` table during Stages A+B).

### Cron cleanup

- Existing `cleanup_app_logs()` pg_cron keeps deleting old `page_views` rows; once Stage B is on, table stops growing and shrinks to zero over the retention window.

## What ships in this plan

- Worker code changes (one new function, ~30 lines modified in `recordPageView`).
- Updated `ingest` edge function (`handleView` → 204 no-op behind a feature flag so we can flip via env var without redeploy).
- Updated worker version banner + memory note.

## What the user does after I ship the code

1. In Cloudflare dashboard → Workers → your worker → Settings → Bindings → add Analytics Engine binding (`AE_PAGEVIEWS` → `shopbanao_pageviews`).
2. Deploy the updated worker (paste into Cloudflare or `wrangler deploy`).
3. Wait 24h, then run a verification query (provided) comparing AE counts vs Supabase `page_views` counts for the same window. Within ~5%, we're good.
4. After 7 days, tell me "flip to AE-only" and I'll set `PV_WRITE_SUPABASE = false`.

## Risks and mitigations

- **AE binding not yet added** → Worker code guards every write with `if (env.AE_PAGEVIEWS)`. Without the binding it silently falls back to current behavior. Safe to deploy code before binding.
- **Count drift** → Stage A dual-write makes drift visible before we commit.
- **Read path still needs DB** → unchanged until Phase 3. No regression for merchants viewing analytics.
- **AE 90-day retention** → for long-term history, Phase 3 adds an optional R2 archive (out of scope here).

## Expected impact (after Stage B)

- Supabase Network egress: −20% (the entire page_views slice).
- Supabase edge function invocations: ~zero pageview writes (vs ~60k/day projected at 100 stores).
- DB row growth: page_views stops growing entirely.
- Cost at 100 stores: pageview pipeline goes from ~₹300/mo to ₹0.
