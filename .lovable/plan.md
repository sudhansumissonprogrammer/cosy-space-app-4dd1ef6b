# Tier 1 — Safe Cost & Performance Wins

Goal: ship 9 zero/low-risk optimizations, ~₹780/mo saved. Each item is independently revertable. Order chosen so the riskiest visual items (AVIF, quality 75) ship last after monitoring.

## Ground rules (apply to every item)

- One item per commit so any regression is bisectable.
- After each Worker change → user manually redeploys `docs/cloudflare-worker-current.js` and we check 1 storefront before moving on.
- After each DB function change → use **DROP FUNCTION IF EXISTS** first (event trigger `guard_storefront_rpc_overloads` will reject otherwise).
- No item touches business logic, payment, auth, or order flow.

---

## Phase A — Pure backend wins (no UX change possible)

### A1. CAPI skip when no pixel (#3)
- File: `supabase/functions/_shared/firePurchaseCapi.ts`
- Code already early-returns when `facebook_pixel_id` is null (line 105). Add an upstream **cheap check**: cache `store.facebook_pixel_id` presence in a small in-memory map keyed by `store_id` for 5 min so we skip the Supabase select entirely on the 95% of stores with no pixel.
- Safety: behaviour identical, only avoids a DB roundtrip. No fallback needed.

### A2. `page_views` 30 s session dedupe (#2)
- File: `supabase/functions/ingest/index.ts` (insert at line 138).
- Add a Deno KV (or in-memory `Map` with TTL) keyed by `${store_id}:${session_id}:${path}`. If hit within 30 s → 204 no-op.
- Safety: analytics aggregates unchanged (duplicates within 30 s are beacon noise per the existing comment in code). Add a `dedup_skipped` counter to the response so we can confirm in logs.

### A3. Auth session cache 5 min (#15)
- File: `src/contexts/AuthContext.tsx` (around `getSession()` at line 40 + any polling).
- Wrap `getSession()` in a 5-min memo; rely on existing `onAuthStateChange` for invalidation. JWT itself is valid 1 h, so this only collapses redundant calls.
- Safety: `onAuthStateChange` still fires on real login/logout, so UI stays correct.

### A4. Disable Realtime on storefront tables (#8)
- Migration: `ALTER PUBLICATION supabase_realtime DROP TABLE` for any storefront-facing tables currently in the publication (products, categories, store_pages, stores, store_theme_config). Keep `partner_notifications` and any dashboard tables that need it.
- Verification step before running: query `pg_publication_tables` to list current members, share with user, then drop only confirmed-unused ones. The only realtime consumer I found is `src/components/partner/NotificationsBell.tsx` on `partner-notif-*`.
- Safety: storefronts already poll; dashboard uses different tables.

---

## Phase B — Caching / shape changes (still safe, easy revert)

### B1. Worker TTL 1 h + purge guarantee (#1)
- File: `docs/cloudflare-worker-current.js`
- Today: `CACHE_STOREFRONT_TTL = 7_200` (2 h), `KV_STOREFRONT_TTL = 86_400` (24 h). Spec asks for **1 h edge TTL**. Lower to `CACHE_STOREFRONT_TTL = 3_600` and keep `KV_STOREFRONT_TTL = 3_600` (matches "1h" spec). Actually we **raise effective TTL via purge**: keep KV at 86_400 so cold edges still hit KV, and the purge endpoint (already wired in `src/lib/purgeStoreCache.ts`) wipes on every save.
- Verify `/api/purge-store` invalidates BOTH the Cache API entry AND the KV key for each hostname. If KV purge missing, add it.
- Safety: purge already runs on every dashboard save (`useStorePurge`). Worst case: a save races and a shopper sees 1 h old data — same as today's 2 h window, strictly better.

### B2. Lite shell RPC (#6)
- Migration (DROP-FIRST):
  ```sql
  DROP FUNCTION IF EXISTS public.get_storefront_shell_lite(text);
  CREATE OR REPLACE FUNCTION public.get_storefront_shell_lite(_slug text) …
  ```
- Returns only fields the SPA shell needs for first paint: `id, name, slug, logo_url, theme, currency, custom_domain, meta_title, meta_description, og_image_url, total_products`. Drops `about_us_text`, `mobile_hero_images`, `business_hours`, full policies, etc. (those load on demand from existing `get_storefront_shell`).
- Worker shell path calls `_lite`; on miss/error → fall through to existing `get_storefront_shell`.
- Safety: net-new function. Old one untouched. Reversible by flipping a Worker constant.

### B3. Image pre-warm 3 sizes (#4)
- File: `src/lib/uploadOptimizedImage.ts` currently uploads only 800w. Add 400w + 1600w variants during the same `processImageMultiSize` call (helper already supports it — see `VariantWidth`).
- Update `resolveVariantUrl` / `optimizeImageUrl` so 400/800/1600 hit the pre-built file directly, skipping Supabase Render API.
- Safety: existing 800w stays the canonical. New variants are extra files, missing variant falls back to Render API. No data migration.

---

## Phase C — Visual quality items (ship last, monitor)

### C1. Quality 85 → 75 for thumbnails only (#12)
- File: `src/components/storefront/OptimizedImage.tsx` and `src/lib/imageOptimize.ts`.
- Default `quality` param stays 85. `OptimizedImage` gets a `priority` already; add rule: if **not** `priority` AND width ≤ 600 → quality 75. Hero/banner (`priority=true`) stays 85.
- Safety: only thumbnails change. One-line revert.

### C2. AVIF format with WebP fallback (#11)
- File: `src/lib/imageOptimize.ts` Supabase Render branch. Add `format=auto` query param (Supabase Render returns AVIF to capable browsers, WebP otherwise — server-side content negotiation, no client check needed).
- Safety: Render's `format=auto` is the documented safe path. Worst case Safari <16 keeps WebP.

---

## Verification per item

| Item | Check |
|------|-------|
| A1 | `supabase--edge_function_logs firePurchaseCapi` → expect "skip: no pixel" majority |
| A2 | 5 quick reloads of same storefront → only 1 row in `page_views` |
| A3 | Network tab: no `/auth/v1/user` polling after login |
| A4 | `select * from pg_publication_tables where pubname='supabase_realtime'` → storefront tables gone |
| B1 | Save a product → reload storefront → see edit within 1 s |
| B2 | Worker log shows `get_storefront_shell_lite` invocations; storefront renders normally |
| B3 | Upload a new product image → Storage shows `-400w`, `-800w`, `-1600w` files |
| C1 | Visual diff thumbnails: no banding |
| C2 | `curl -H "Accept: image/avif" <url>` returns `content-type: image/avif` |

---

## Out of scope

- Per-merchant OAuth, edge SSR for humans, GSC auto-submit, blog/guides expansion — already tracked in Phase 4 of the SEO plan.
- Worker auto-deploy — file remains manual.

## Files touched (no code written until plan approved)

```text
supabase/functions/_shared/firePurchaseCapi.ts   A1
supabase/functions/ingest/index.ts               A2
src/contexts/AuthContext.tsx                     A3
migration (publication drop)                     A4
docs/cloudflare-worker-current.js                B1, B2 (manual redeploy)
migration (get_storefront_shell_lite)            B2
src/lib/uploadOptimizedImage.ts                  B3
src/lib/imageOptimize.ts                         B3, C1, C2
src/components/storefront/OptimizedImage.tsx     C1
```

Estimated wall time: ~10 h spread across 3 sittings (A → wait 24 h → B → wait 24 h → C).
