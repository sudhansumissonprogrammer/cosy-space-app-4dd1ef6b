## Goal

Cut serdiyajewellers.shop (and every storefront) cold-load FCP from ~3.2 s to **1.2 – 1.5 s** without changing behavior or risking ban/SEO. Done in 4 small, reversible phases — each phase is independently shippable and measurable.

## Measured baseline (cold load, real browser)

| Metric | Now |
|---|---|
| HTML document loaded | 1969 ms |
| First Paint | 2032 ms |
| FCP | **3248 ms** |
| Slowest XHRs | products 1073 ms, shipping 822 ms, get_store_public_email 808 ms, shell 761 ms |
| Duplicate fonts | `/fonts/alegreya-sc-*` (self-host) **and** `fonts.gstatic.com/alegreyasc/*` (Google) — both fire |

## Root causes confirmed in the code

1. **Worker awaits shell RPC before flushing HTML.** `docs/cloudflare-worker-current.js` calls `prefetchStorefrontDataWithDeadline(...)` then builds the full string in `injectIntoHtml()` and only then returns the `Response`. Browser sees byte-0 only after the Supabase round-trip.
2. **Font duplication.** Worker’s `SELF_HOSTED` map keys on the exact font name (`"Alegreya SC"`). If the store’s `theme_config.heading_font` is stored as `"Alegreya"` or any variant, Worker falls through to Google Fonts AND `index.html`'s fallback `injectGFont(...)` (lines 136-146) can also fire. Also `index.html` line 81 unconditionally loads Montserrat Alternates via Google on every route, including storefronts.
3. **Post-paint serial Supabase calls.** Even though Worker inlines `__STOREFRONT_DATA__`, the React app still fires:
   - `rpc/get_store_public_email` (808 ms) — for the "contact owner" link
   - `store_shipping_config` (822 ms) — for TrustStrip/Cart
   - `products` (1073 ms) — when Worker didn’t inline products
   - `rpc/get_storefront_shell` (761 ms) — because `useStorefront` re-fires when the Worker’s injected data races with the in-page prefetch and the bridge timeout fires.
4. **`supabase-js` chunk loads on storefront home.** `src/layouts/StorefrontLayout.logic.ts` does `await import("@/integrations/supabase/client")` even when data is already inlined.

## Phase 1 — Streaming HTML in the Worker  (biggest win, -1200 ms FCP)

**Files:** `docs/cloudflare-worker-current.js` only.

Convert `injectIntoHtml(...)` from "build string → return Response" to a `TransformStream` pipeline:

```text
fetch(originHtmlPromise)                  ── start in parallel
fetch(get_storefront_shell RPC)           ── start in parallel
writer.write(<head> + skeleton CSS + font preloads + LCP preload)   ← T+30ms, browser starts CSS/JS
await shell                                                          ← T+700ms
writer.write(<meta og>, <title>, theme CSS, __STOREFRONT_DATA__ script)
writer.write(<body> + skeleton)
writer.close()
```

Implementation steps:
1. Add a new helper `streamStorefrontHtml(slug, ctx, env, hostname)` that returns `new Response(readable, { headers: ... })`.
2. Move only the *static, store-independent* parts of `injectIntoHtml` (skeleton, critical product-card CSS, Inter font preload, hardcoded `<link rel=preload>` for /assets/*.css) into a `buildEarlyHead()` function that runs synchronously.
3. Move the *store-dependent* parts (OG meta, theme CSS, `__STOREFRONT_DATA__`, hero preload) into `buildLateHead(shell)` that runs after the RPC resolves.
4. Pipe via `TransformStream`, flush early chunk, then await shell, then flush late chunk + body.
5. Cache the streaming response via `ctx.waitUntil(cache.put(...))` only after both halves are committed (use a `TeeStream` so cache gets the full HTML).
6. Routes already covered by `_memShell` / KV stay synchronous (single write).

Roll-out safety:
- Behind a Worker env flag `STREAM_HTML="1"`. Default off. Flip on for one custom domain first (`serdiyajewellers.shop`), measure, then enable globally.
- Add `X-Stream: early|full` header for observability.
- Roll back = unset env var, redeploy (≈30 s).

Expected: HTML head arrives at ~150 ms (instead of 1900 ms). FCP drops by ~1.2 s.

## Phase 2 — Fix font duplication  (-600 to -800 ms FCP)

**Files:** `docs/cloudflare-worker-current.js`, `index.html`.

1. **Normalize font names in Worker `SELF_HOSTED` lookup.** Add a helper `normalizeFontName(s)` that lowercases + trims, and use a normalized map so `"alegreya sc"`, `"Alegreya SC"`, `"Alegreya"` all hit the local files when we ship them. Add the most-used Indian merchant fonts to the self-hosted folder (`Playfair Display`, `Cormorant Garamond`, `Lora`, `Cinzel`) — one-time `bun add` of the woff2s into `public/fonts/`.
2. **Worker: skip Google Fonts entirely when every requested family is self-hosted.** Today the code already does this, but verify the `remoteFonts.length > 0` branch genuinely is empty for this store post-normalization.
3. **`index.html`: remove the storefront fallback `injectGFont(...)` when the Worker marker is present.** Line 134 already guards on `document.querySelector('link[data-sf-font]')`. Add a second guard: if `window.__SF_WORKER__` is true, skip the entire fallback block — prevents the race where the React fallback fires before the Worker’s `<link data-sf-font>` is parsed.
4. **`index.html` line 81 (Montserrat Alternates Google stylesheet): move into the dashboard-only path.** This font is only used by the dashboard; it shouldn’t be on the storefront critical path. Replace with a runtime injection inside `src/main.tsx`'s existing `loadFonts()` dashboard branch.
5. **Audit `serdiyajewellers` theme_config.** Read the row and confirm `heading_font` value matches the self-hosted whitelist key after normalization. If not, write a one-off migration that normalizes existing rows.

Roll-out safety:
- Pure additive changes for Worker (normalization can’t miss a font, it only catches more).
- `index.html` change is a 1-line guard — easy to revert.
- Test on preview + serdiyajewellers + one other live store before rolling broadly.

Expected: FCP gap (currently 1216 ms between FP and FCP) collapses to ~300 ms.

## Phase 3 — Inline everything React asks for  (-1000 ms perceived, products visible 1 s earlier)

**Files:** `supabase/migrations/*.sql` (new), `src/layouts/StorefrontLayout.logic.ts`, hooks that fetch `shipping_config` / `store_public_email`.

1. **Extend `get_storefront_shell` RPC** to additionally return:
   - `shipping_config` (already partially there per code — verify it’s in payload)
   - `owner_email` (the column `get_store_public_email` returns)
   - `products_preview`: top 20 active products with the same `select=` list the React app uses, ordered by `is_best_selling.desc, created_at.desc, id.asc`
   
   Use the `DROP FUNCTION IF EXISTS` + `CREATE OR REPLACE` pattern (memory rule: an event trigger blocks overloads).
2. **Worker:** inline the new payload into `window.__STOREFRONT_DATA__` (already does shell — just stop trimming the new fields). Set `window.__PRODUCTS_INLINE__ = true` when products are present so `index.html` skips the parallel products fetch entirely.
3. **`StorefrontLayout.logic.ts`:** when injected payload contains `shipping_config` / `products_preview` / `owner_email`, seed the matching React Query keys so child pages skip the network round-trip:
   - `["storefront-shipping-config", store.id]`
   - `["storefront-products-preview", store.id]`
   - `["storefront-owner-email", store.id]`
4. **Audit and delete the now-dead direct Supabase calls** (`rpc/get_store_public_email`, `store_shipping_config`, the early `products?store_id=...` fetch in `index.html` lines 161-171 and 248-267).

Roll-out safety:
- New RPC ships first; React keeps its old calls. Verify shell payload size grows by ≤ 8 KB (still well under Worker’s safe streaming chunk size).
- Then flip React to read from injected data. If anything missing, the existing hooks fall back to the old fetch automatically (already coded that way).
- Old `get_store_public_email` RPC stays around (no DROP) for one release cycle in case a non-home route still calls it.

Expected: products + shipping + owner-email round-trips disappear → ~1 s saved on visible product paint.

## Phase 4 — Drop supabase-js from the storefront critical path  (-200 to -300 ms script duration)

**Files:** `vite.config.ts`, `src/layouts/StorefrontLayout.logic.ts`, `src/hooks/useStorefrontProducts.ts`, `src/hooks/useStorefrontThemeConfig.ts`.

1. Create a tiny `src/lib/storefrontRest.ts` that does plain `fetch()` against `https://<project>.supabase.co/rest/v1/...` with the anon key — no `@supabase/supabase-js` import. Used only for read-only storefront queries.
2. Replace `import("@/integrations/supabase/client")` in storefront hooks with the tiny REST helper.
3. Confirm via the bundle visualizer (`ANALYZE=1 bun run build`) that the `supabase` chunk no longer lands on the storefront homepage graph.
4. Keep the full client for dashboard/checkout/auth.

Roll-out safety:
- Strictly additive; the heavy client stays for non-storefront flows.
- A11y/auth/checkout paths untouched.

Expected: -55 KB JS off cold path, -200 ms script duration, smoother INP.

## Projected timeline after all phases

| Phase | Cumulative FCP | Cumulative TTI |
|---|---|---|
| Baseline | 3248 ms | 2316 ms |
| After P1 (stream) | ~2050 ms | ~1900 ms |
| After P2 (fonts) | ~1300 ms | ~1900 ms |
| After P3 (inline) | ~1200 ms | ~1500 ms |
| After P4 (no supa-js) | **~1150 ms** | **~1300 ms** |

## Rollout & guardrails

- One phase per deploy. Wait 24 h between phases, compare Cloudflare RUM + a fresh `browser--performance_profile` on serdiyajewellers + one other live store.
- All worker changes behind env flags (`STREAM_HTML`, `INLINE_PRODUCTS_V2`). Roll back = unset flag, redeploy.
- DB migration uses DROP-FIRST per project rule; PGRST203 event trigger will catch overload mistakes.
- No change to: auth, payments, RLS, R2 pipeline, ban-risk scrubbers, Meta CAPI, custom domains, SEO `<title>`/canonical logic.

## What is explicitly NOT in this plan

- Migrating edge functions to Workers (Category A from previous chat) — separate workstream, no FCP impact.
- Changing theme system, layouts, or designs.
- Touching dashboard/admin/checkout performance.
- Image pipeline changes — already on R2/cdn.shopbanao.in and fast.

## First action when you approve

Implement **Phase 1 only**: write `streamStorefrontHtml()` in `docs/cloudflare-worker-current.js` behind `STREAM_HTML="1"`. Hand you the updated worker file to paste/deploy, then re-measure on serdiyajewellers before touching Phase 2.
