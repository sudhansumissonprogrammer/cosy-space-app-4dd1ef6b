# Worker v8.24.0 — Fix Cold-Cache Modulepreload + True CF Edge HIT

Three audit findings, fixed in one Worker patch. No frontend changes. No DB changes.

## Finding 1 — Brotli for JS (dashboard toggle, no code)

The `framework-*.js` and `index-*.js` chunks are served with `content-encoding: gzip` instead of brotli. Saves ~100KB per cold load.

**You do this**, not the agent:
- Cloudflare dashboard → your zone (`shopbanao.in`) → Speed → Optimization → **Content Optimization** → enable **Brotli**.
- Zero risk. Takes 30 seconds. Effect is global within a few minutes.

If Brotli is already toggled on, the issue is likely that CF cached a gzip variant for the asset. Purge `/assets/*` from Cloudflare cache to force re-fetch with brotli.

## Finding 2 — Storefront only emits 1 modulepreload tag

### Root cause

The `cold-cache-api` code path (line 5371-5386) skips both `getPrebuiltHead()` and `enrichHeadWithDeepPreloads()`. It calls `injectIntoHtml(shellResult.html, ...)` directly on the raw shell HTML, so:

- The `<!--ENTRY:...-->` marker is never written into the head.
- The deep-modulepreload enrichment pass never runs.
- Result: HTML ships with only the entry script tag's implicit preload — 1 modulepreload, not 6-10.

Audit confirmed: `x-data-source: cold-cache-api` on the response, only `/assets/index-*.js` preloaded.

### Fix

In the cold-cache-api path (around line 5371-5386):

1. Call `getPrebuiltHead(shellResult.html, env)` to get the enriched head with the `ENTRY:` marker.
2. Call `enrichHeadWithDeepPreloads(prebuiltHead, origin, env)` to splice in modulepreloads for framework, App, storefront-shell, supabase, router-query.
3. Pass the enriched head through `injectIntoHtml` (or post-process the result to swap `<head>...</head>` with the enriched version).

Apply the same fix to any other `cold-*` branches that bypass the enrichment pass.

### Expected result

After the patch, storefront cold HTML should contain 6-10 `<link rel="modulepreload">` tags. Browser fetches framework + App + supabase + storefront-shell in parallel from byte 0 instead of discovering them serially. Cuts ~600-1000ms off cold load on 4G mobile.

## Finding 3 — `cf-cache-status: MISS` on every storefront hit

### Root cause

Two things compound:

1. `setNoStoreHtmlHeaders` (line 1205) sets `Cache-Control: public, max-age=0, must-revalidate, stale-while-revalidate=300` on the client-facing response. CF refuses to edge-cache anything with `max-age=0, must-revalidate`.
2. The Worker fronts the route and never reads `caches.default.match(request)` before running its logic. CF's cache layer is bypassed entirely — every visitor pays full Worker compute (~290ms TTFB) even when a perfect mirror exists in Cache API.

The `mirrorToCfCache` helper does store a clean copy under the real request URL (with `max-age=3600`), but nothing reads it back.

### Fix

Two-part change inside the main fetch handler:

**a) Read CF Cache API at request entry for cacheable storefront paths.**

Right after host + path resolution, before any shell/data work:

```js
// Only for GET on storefront HTML paths, no auth cookies, no checkout/dashboard/admin.
if (
  request.method === "GET" &&
  isHtmlNavigationPath(pathname) &&
  !pathname.startsWith("/checkout") &&
  !pathname.startsWith("/dashboard") &&
  !pathname.startsWith("/admin") &&
  !(request.headers.get("cookie") || "").match(/auth|sb-/)
) {
  const hit = await caches.default.match(request);
  if (hit) {
    const r = new Response(hit.body, hit);
    r.headers.set("X-Edge-Mirror-Hit", "1");
    r.headers.set("X-Worker-Version", WORKER_VERSION);
    return r;
  }
}
```

This lets a warm CF mirror short-circuit the Worker entirely. After the first hit warms `mirrorToCfCache`, subsequent visitors get sub-50ms TTFB and `cf-cache-status: HIT` (technically still served via Worker, but with `X-Edge-Mirror-Hit: 1` as our metric).

**b) Loosen client cache-control on storefront HTML so CF will store it.**

Change `setNoStoreHtmlHeaders` to send `public, max-age=60, stale-while-revalidate=86400` instead of `max-age=0, must-revalidate`. With 60s of fresh client cache plus background SWR, merchants still see edits within 60s on repeat visits, and Cloudflare's automatic cache will start serving `cf-cache-status: HIT` on its own without requiring our manual mirror.

If you'd rather keep `max-age=0` for instant publish visibility, the manual mirror in (a) is enough — skip (b).

### Expected result

- First visitor: ~290ms TTFB (Worker computes, warms mirror).
- Repeat visitors: ~30-50ms TTFB, `X-Edge-Mirror-Hit: 1`, Worker compute skipped.
- After (b) is applied: `cf-cache-status: HIT` shows in Cloudflare analytics, cache rate metric stops being 0%.

## What I will change

- `docs/cloudflare-worker-current.js` only.
- Bump `WORKER_VERSION` to `8.24.0-edge-hit-and-coldpreload`.
- No frontend or DB changes.

## What I won't touch

- `r2-upload` / R2 pipeline (working perfectly).
- Skeleton, theme injection, inline data — all working.
- Brotli for JS — your dashboard toggle.

## Deploy

After approval I'll patch the file. You then deploy the Worker the usual way (paste/upload to Cloudflare).

## Safety

- Read-side Cache API check is gated to anonymous GET on storefront paths — no risk of leaking auth or serving stale checkout.
- `cold-cache-api` path keeps identical inject-data behavior, only adds the head enrichment that was missing.
- Cache-control change (b) is optional; if it causes any merchant-side visibility issue we revert it independently. Manual mirror in (a) is the load-bearing fix.
