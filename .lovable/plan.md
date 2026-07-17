# Ban-Risk Deep Fix Plan — Worker + Pixel/CAPI Integrity

Fifteen findings, grouped by blast radius. Every fix is scoped so it CANNOT regress checkout, storefront rendering, or shopper analytics. Worker changes ship as one `docs/cloudflare-worker-current.js` diff (single `WORKER_VERSION` bump) so cache keys auto-invalidate — no half-state.

---

## Group A — Worker: crawler parity + cache correctness (findings 1, 2, 3, 4, 5, 6, 7, 8)

Root cause across all eight: bot branches diverge in HTML shape, cache keys, and rate limits, and social bots get a weaker document than Googlebot. Meta compares crawls over time and across UAs — divergence == cloaking signal.

### A1. Unify bot cache namespace + shorten TTL (finding 1)
- Replace the split `bot-cache/search/...` and `bot-cache/social/...` keys with a single `bot-cache/v{WORKER_VERSION}/{hostname}{path}` namespace, keyed additionally by a coarse `botClass` (`search` | `social`) so purges hit both.
- Reduce `max-age` from 86400 → 3600 (SWR already 3600). Meta re-crawls hourly; 24h stale is the actual cloaking trap when we ship a fix.
- Skip cache entirely when the response is a fallback/error (never poison the key with a partial document).

### A2. Extend bot regexes to cover all Meta UAs (finding 2)
- Add to `SOCIAL_BOT_REGEX`: `meta-externalagent`, `meta-externalfetcher`, `facebookcatalog`, `FacebookBot` (case-insensitive already).
- Same additions to `BOT_UA_REGEX` so `handleBot()` intercepts them.
- Keep the existing exemption for FB/WA in-app webviews (`isSocialInAppBrowser`) untouched — that path stays a real user.

### A3. Raise Meta-crawler rate limits + exempt verified Meta UAs from generic bot throttle (finding 3)
- `bot:` bucket: 60/min stays for anonymous scrapers.
- `anybot:` bucket: raise 30 → 120/min AND skip entirely when UA matches `SOCIAL_BOT_REGEX` or `SEARCH_BOT_REGEX`. The 429 response was the direct trigger for `unverifiable_url`.
- Never return 429 to Meta UAs; if truly abusive, degrade to a static cached OG document instead.

### A4. Kill product/price leak from generic-bot homepage HTML (finding 4)
- In `_buildSeoBodyBlock`, gate the `Featured Products` and price rendering behind `isSearchBot === true`. Pass an `audience` param from `injectStorefrontData`/homepage path (default `"human"`; only search bots get the product list).
- Social bots keep name + tagline + about + categories + FAQ — same shape as `bot-render` homepage. This closes the cross-crawler divergence.

### A5. Bring social-bot HTML to parity with `bot-render` (finding 5)
- `buildOgHtml` currently emits `og:type=website` for products. Change to `og:type=product` when `og.price` is present (already have the signal).
- Extend `bot-render`'s product Product-JSON-LD (SKU, brand, breadcrumbList) into `buildOgHtml`'s LD block so the two crawlers see identical structured data.
- H1 for products: use `og.title` alone (matches `bot-render`), not the split site-name.

### A6. Remove permanent duplicate `<h1>` in DOM (finding 6)
- Skeleton/`#seo-content` injected by Worker stays in the doc after React hydrates → two `<h1>` for real users.
- Fix client-side: in `StorefrontShell`, on `storefront:content-ready` (already dispatched), remove `document.getElementById("seo-content")`. Same effect Worker skeleton removal has today via `__SF_WORKER__` — mirror that pattern.
- Idempotent, runs once, guarded like the ready-fire flag.

### A7. Narrow the UA 403 blocklist (finding 7)
- Drop `python-requests`, `Go-http-client`, `node-fetch`, `axios/` from `BLOCKED_BOT_REGEX`. These UAs are used by Meta's ad-review sandboxes and by legitimate integration tests.
- Keep `AhrefsBot|SemrushBot|MJ12bot|…` (SEO scrapers only, zero ad-policy impact).

### A8. Fix legacy `/cf-img` 410 for Meta-only product images (finding 8)
- Root cause: old `bot-render` cache entries reference `/cf-img?url=…` which now 410s. Meta re-crawls the cached HTML and sees broken product images → "landing page mismatch".
- Fix: in `bot-render/index.ts`, rewrite any `/cf-img?url=<encoded>&…` in `image` fields to the encoded target URL directly (R2 URLs already go through `cdn.shopbanao.in`, no resize needed). Also add a Worker compat shim: if `/cf-img?url=…` receives a request, 302 to the decoded URL instead of 410 — one-line safety net for anything cached anywhere.

---

## Group B — Pixel / CAPI integrity (findings 9, 10, 11, 12, 13, 14, 15)

### B1. Unique constraint on `stores.facebook_pixel_id` (finding 9)
- Migration: partial unique index `CREATE UNIQUE INDEX stores_pixel_id_unique ON stores (facebook_pixel_id) WHERE facebook_pixel_id IS NOT NULL AND facebook_pixel_id <> ''`.
- Add matching check in `StoreTracking.tsx` save flow: pre-validate via `select … where facebook_pixel_id = ?` and show "This Pixel is already used by another store" instead of a raw 23505 error.
- Pre-migration audit query listed in the technical section; if collisions exist, we surface them to the user before applying (no auto-mutation of existing rows).

### B2. Restore Serdiya's `facebook_pixel_id` (finding 10)
- Data-only fix: verify current value via `read_query`, then `insert`-tool UPDATE to restore `1687639985774634` (the Pixel ID confirmed live in the browser this morning). Also invalidate `stores_tracking_audit` by writing a fresh audit row.
- No code change — this is a config regression we already diagnosed.

### B3. Prevent fake COD Purchase inflation (finding 11)
- In `place-order`, when `payment_method === "cod"`:
  - Require `checkout_token` (already issued via `create-upi-intent`/checkout init). Reject requests without a valid, recent, unused token bound to the same `store_id` + `cart hash`.
  - Rate-limit per `buyer_ip` + `customer_phone` (5 COD orders / 10 min) using the persisted DB table below (not the in-memory map, which is B4).
  - Strip client-supplied `meta.fbp`/`meta.fbc` when the request has no matching `sf_vid` cookie signal (external_id absent AND no server-side session). Regex-valid strings alone are not proof.
- `firePurchaseCapi` already skips manual orders — extend the "skip" gate to skip when both `buyer_fbp` and `buyer_fbc` were synthesized after strip.

### B4. Persistent, cross-isolate rate limits (finding 12)
- New table `edge_rate_limits(key text primary key, window_start timestamptz, count int)` with a `hit_rate_limit(_key text, _max int, _window_seconds int)` security-definer RPC (atomic UPSERT + increment, returns boolean).
- `place-order`, `meta-capi`, `verify-meta-capi` call the RPC instead of the in-memory `rlMap`. Fail-open on RPC error (don't break checkout for a limiter blip).
- Prune job: nightly cron edge fn deletes rows where `window_start < now() - interval '1 day'`.

### B5. Proactive apex-cookie purge before any Pixel call (finding 13)
- `purgeSharedDomainCookies` runs in a `useEffect` — race with the inline pixel bootstrap in `index.html`. Move the purge into the inline `<script>` in `index.html`, executed **before** `fbq('init', ...)`. Client `useEffect` version becomes the idempotent second pass (no-op after inline run).
- Also emit a `SameSite=Lax; Secure` on freshly minted `_fbp` so it's host-only by default in modern browsers.

### B6. Force `test_event_code` on verify-meta-capi (finding 14)
- Already sends `test_event_code: "TEST12345"` — audit confirmed. Harden by:
  - Rejecting the request if `test_event_code` is somehow stripped downstream.
  - Making the code configurable per-env (`Deno.env.get("META_TEST_EVENT_CODE") || "TEST12345"`) so we never accidentally drop it in prod builds.
- Also switch `event_name` from `PageView` → a dedicated `TestPixelVerify` custom event **only when** `test_event_code` is set, to keep EMQ dashboards clean.

### B7. Cross-tab PageView dedup (finding 15)
- Replace `sessionStorage` (tab-scoped) with a `localStorage`-backed short-window dedup: key `__sf_pv_dedup_{storeId}_{path}`, value = timestamp, TTL 3s.
- Wrap in a `try/catch` and add a `BroadcastChannel("sf-pv")` fallback so two tabs opened simultaneously still dedupe within a paint.
- Initial-load PageView (fired by inline pixel in `index.html`) writes the same dedup key with its `__SF_PV_EVENT_ID__`, so a hydration-time refire is skipped without race.

---

## Rollout order (safety gates)

1. **DB migration** for B1 unique index + audit query. If collisions exist, stop, surface to user, do NOT auto-mutate.
2. **DB migration** for B4 rate-limit table + RPC.
3. **Edge function** updates: `place-order` (B3), `meta-capi` (B4), `verify-meta-capi` (B6), `bot-render` (A8).
4. **Client** changes: `StorefrontShell` (A6, B7), `index.html` (B5).
5. **Worker file** diff (A1–A5, A7, A8 shim) with `WORKER_VERSION` bump — user deploys manually.
6. **Data-only restore** for B2 (Serdiya pixel).

Nothing changes checkout UX, address validation, or shopper-facing components. Purely infra + tracking parity.

---

## Technical section (for review)

**Files touched**
- `docs/cloudflare-worker-current.js` — A1..A5, A7, A8 shim
- `supabase/functions/bot-render/index.ts` — A5 (JSON-LD parity), A8 (cf-img rewrite)
- `supabase/functions/place-order/index.ts` — B3
- `supabase/functions/meta-capi/index.ts` — B4
- `supabase/functions/verify-meta-capi/index.ts` — B6
- `src/layouts/StorefrontShell.tsx` — A6, B7
- `index.html` — B5 (inline cookie purge before pixel init)
- New migration: `stores_pixel_id_unique` partial index; `edge_rate_limits` table + `hit_rate_limit` RPC + grants.
- New edge fn: `edge-rate-limit-gc` (nightly cron).

**Pre-migration audit**
```sql
SELECT facebook_pixel_id, count(*), array_agg(slug)
FROM stores WHERE facebook_pixel_id IS NOT NULL AND facebook_pixel_id <> ''
GROUP BY 1 HAVING count(*) > 1;
```
If any row returns >1, we pause and ask the user which store keeps the Pixel before adding the unique index.

**Rollback plan**
- Worker: user can redeploy the previous `WORKER_VERSION`; bot cache keys are versioned so old cache resurfaces cleanly.
- Migration B1: drop the partial index (`DROP INDEX stores_pixel_id_unique`). No data mutated.
- Migration B4: drop table + RPC; edge fns fall back to in-memory limiter (kept as second-tier guard).
- All client changes are additive/gated — reverting the file restores prior behavior.
