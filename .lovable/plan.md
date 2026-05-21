# Worker v8.26.0 — fixes verified deployment gaps

## What was actually broken in v8.25.2 (confirmed via live tests)

Live test results on `serdiyajewellers.shop` showed:

- Every request: `cf-cache-status: MISS`, fresh `x-cache-timestamp` each time
- No `x-edge-cache: HIT-EARLY` or `x-edge-key` header ever appeared
- Only **1** `<link rel="modulepreload">` in HTML (should be 5–10)

## Root causes found

### Bug 1 — Deep modulepreload never injected
`enrichHeadWithDeepPreloads` used regex `/<!--ENTRY:([^>-]+)-->/`. The `[^>-]` class
excludes both `>` AND `-`. Vite chunk filenames always contain hyphens
(`index-CdOv1bdp.js`), so the capture group never matches, so
`getDeepChunkPreloads(marker[1])` is never called, so no deep preloads
get injected. Cold loads waterfall through chunks one by one.

Fix: change to `[^>]+`.

### Bug 2 — Canonical-slug cache key never resolved for custom domains
`_earlyResolveSlug` only checks `cache.match("https://cache/domain-<host>")`.
Cloudflare silently rejects writes to synthetic hostnames in some colos, so
this lookup almost always returns null for custom domains. That means the
canonical-slug cache key (the whole point of v8.25.2) is never tried, only
the real-host key is, which itself can be unreliable across zones.

Fix: fall back to `env.STORE_KV.get("domain:<host>")` (~5ms) when Cache API
returns nothing. KV already stores this mapping for 24h.

### Bug 3 — `addDiagnosticHeaders` permanently masked CF cache HITs
Line 581 unconditionally did `res.headers.set("cf-cache-status", cacheStatus)`
for any internal status — including MISS, ORIGIN, STREAMING, etc. This
overwrote Cloudflare's real edge-cache result and made the dashboard cache
rate look stuck at 0% even when CF was serving from its cache.

Fix: only mirror to `cf-cache-status: HIT` when the internal status starts
with hit / cached / memory / kv / edge / warm. Otherwise leave whatever
Cloudflare set in place.

## Validation after deploy
1. `curl -sI https://serdiyajewellers.shop/` repeated 3× — expect
   `cf-cache-status: HIT` and stable `x-cache-timestamp` from request 2 on,
   `x-edge-cache: HIT-EARLY` with `x-edge-key: canonical-slug` for
   custom-domain hits.
2. View HTML source — expect 5+ `<link rel="modulepreload">` tags in `<head>`.
3. Same for `imitationworld.in` and `fitness.shopbanao.in`.

## Safety
- No DB / RLS changes.
- No frontend changes.
- Worker file only — manual deployment required (user pushes via
  Cloudflare dashboard or wrangler).
