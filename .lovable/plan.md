
# Cloud Bill Reduction — Safe Plan (no UX regression)

Three hard requirements drive every choice below:
1. **Merchant edits must appear instantly** for shoppers
2. **Meta Pixel + CAPI ROAS must keep working** for ad-running stores
3. **Cold load must stay fast** (no slow first-paint regressions)

Estimated bill impact: **~$1/day → ~$0.55/day** (−45%) with **zero shopper-facing regression**.

---

## 1. Worker shell cache: TTL 1 hour + reliable purge on every save

**What changes**
- Bump `s-maxage` for `get_storefront_shell` and `get_storefront_data` worker responses to **3600s** (1h), with `stale-while-revalidate=86400`
- Audit every dashboard save mutation and ensure `useStorePurge(storeId)` is called in `onSuccess`
- Add a single shared `usePurgeOnSuccess` wrapper so future saves can't forget

**Why this keeps edits instant**
The worker only serves stale data if no purge fires. Every legitimate edit path (theme, logo, banner, hero, products, categories, custom pages, store settings, payment config, shipping) calls `purgeStoreCache(slug, custom_domain)` which wipes the CF edge cache for that store immediately. Result: shoppers see new data within ~1s of merchant clicking Save.

**Pages to audit for missing purge calls**
StoreSettings, StoreThemeSettings, StorePages, StorePageEditor, CategoryManagement, BestSellerManagement, StorePayments, StoreShipping, StoreDomain, ProductForm (create/edit), CreateStore, BulkUpload, MediaLibrary deletions, StoreTaxSettings, StoreTracking.

**Safety net**
Add an admin-only "Purge cache for this store" button in `AdminUsersStores` for emergencies.

---

## 2. Page-views debounce (per session, per path, 30s)

**What changes**
- In the page-view recording hook, before insert: check `sessionStorage` for key `pv:{storeId}:{path}`. If timestamp <30s old → skip insert. Else write key + insert.
- Add tooltip in admin Analytics: "Views are deduped per visitor per page within a 30-second window."

**Why ROAS is unaffected**
Pixel/CAPI events fire on a separate path (`metaCapi.ts`) — they are not tied to `page_views` inserts. Ad attribution uses Meta's own pixel, not our page_views table.

---

## 3. CAPI: skip only when store has no Meta pixel (preserves ROAS)

**What changes**
- In `metaCapi.ts`, before the probe call, check `store.facebook_pixel_id`. If null/empty → return early, never call the edge function.
- Stores that DO have a pixel configured → behave exactly as today (every event probed, sent to Meta when token configured).

**Why ROAS stays intact**
Stores running Meta ads always set `facebook_pixel_id`. Skipping CAPI only on stores with no pixel removes pure waste (~80% of stores). Ad-running stores keep 100% of current CAPI behavior — no fbclid checks, no cookie checks, no attribution loss.

---

## 4. Selective prewarm cron (active stores only)

**What changes**
- Modify `prewarm-cron` edge function to query: stores with ≥1 page_view in the last 24h
- Warm only those stores (currently warms all 20 regardless of activity)
- Keep the cron schedule as-is

**Why cold load stays fast**
Stores receiving real traffic stay warm. Inactive stores don't need warming because:
- First visitor triggers `prewarm-store` automatically on landing
- Worker also fetches+caches on first miss
A truly cold store's first visitor sees ~300ms TTFB (acceptable for a store with zero traffic). Active stores stay at ~50ms.

---

## 5. Error logs hygiene (size + noise control)

**What changes**
- Daily pg_cron job: `DELETE FROM error_logs WHERE created_at < now() - interval '30 days'`
- Add client-side throttle in `logError.ts`: max 5 logs per error-message-hash per session (sessionStorage counter)
- One-time investigation query to identify top error sources currently flooding the table

**Why this is safe**
30 days is plenty for debugging. Throttle prevents one buggy component from filling the table with thousands of identical rows.

---

## What we are NOT doing (and why)

| Skipped | Reason |
|---|---|
| Compress shell payload (drop fields per route) | Adds RPC overload risk and cache fragmentation; complexity > savings at 20 stores |
| Reduce prewarm frequency blindly | Would slow cold loads; selective warming is strictly better |
| Skip CAPI on missing fbclid | Would hurt returning-customer attribution and ROAS for ad-running stores |
| Shorten worker TTL to 15 min | Unnecessary if purge coverage is solid; 1h gives bigger savings with same UX |

---

## Technical details (for the dev)

### Files to modify
- `docs/cloudflare-worker-current.js` — bump shell + data TTL constants; user must redeploy worker manually
- `src/hooks/useStorePurge.ts` — already exists, just ensure usage everywhere
- All dashboard save pages listed in §1 — add `purge()` to onSuccess if missing
- `src/lib/metaCapi.ts` — early return when `store.facebook_pixel_id` is missing (pass pixel_id into the call site)
- Page-view recording hook (likely in `StorefrontShell.tsx` or a hook called from it) — add sessionStorage debounce
- `supabase/functions/prewarm-cron/index.ts` — query active stores via `page_views` last 24h
- `src/lib/logError.ts` — add per-session throttle
- New migration: pg_cron daily cleanup of `error_logs` >30 days

### Deployment notes
- Worker change requires manual deploy by the user (per project memory)
- All other changes deploy automatically via Lovable Cloud
- DB function untouched → no overload-guard risk

### Verification checklist
1. Edit store name in dashboard → confirm shopper sees new name within 2s on hard refresh
2. Edit a product → same check
3. Open ad-running store with `?fbclid=test` → confirm CAPI probe still fires
4. Open store with no pixel configured → confirm zero meta-capi network calls
5. Refresh storefront 5x in 30s → confirm only 1 page_view row inserted
6. Check `prewarm-cron` logs → confirm it only touches active stores

---

## Expected outcome after deploy

| Metric | Before | After |
|---|---|---|
| DB load (% of bill) | 63% | ~30–35% |
| Network (% of bill) | 35% | ~25% |
| Daily bill | ~$1.00 | ~$0.55 |
| Shopper TTFB (warm) | ~50ms | ~50ms (unchanged) |
| Shopper TTFB (cold active) | ~50ms | ~50ms (unchanged) |
| Edit-to-visible delay | <1s | <1s (unchanged) |
| Meta CAPI events for ad stores | 100% sent | 100% sent (unchanged) |
| `error_logs` table size growth | ~3MB/mo | ~0.5MB/mo |
