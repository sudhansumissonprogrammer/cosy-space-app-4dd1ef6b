# Goal

Bring monthly Cloudflare usage **per single active store** to:

- **KV Writes**: under **10%** of the 1M free tier (≤ 100k/month)
- **Workers Requests**: under **20%** of the 10M free tier (≤ 2M/month)

Current baseline (your 7-day numbers, 1 active store: serdiyajewellers): ~104k KV writes / week → ~446k/mo (44%), ~641k Worker req / week → ~2.75M/mo (27%). Both need ~50–70% reduction.

# Where Writes Come From (deep audit of `docs/cloudflare-worker-current.js`)

I traced every `STORE_KV.put` and `cache.put` in the 4187-line worker. The hot-path writers, ranked:


| #   | Writer                                                                                       | TTL      | Trigger frequency                             | Est. share |
| --- | -------------------------------------------------------------------------------------------- | -------- | --------------------------------------------- | ---------- |
| 1   | `warm-lock:{slug}` (line 2050) — SYNC put on every shell-fetch race                          | 300s     | Every cold isolate hit                        | ~30%       |
| 2   | `cron scheduled()` (line 4014–4053) — `store-info`, `store-id`, `domain`, `all-active-slugs` | 1h–6h    | Every 30 min                                  | ~25%       |
| 3   | `store-info:{slug}` lazy resolve (line 1521) + NOT_FOUND writes (line 1484, TTL only 30s!)   | 1h / 30s | Every isolate cold-start, every bad URL       | ~20%       |
| 4   | `pv:{domain}` product-version bump (line 2144)                                               | 24h      | Every dashboard save / `/api/purge`           | ~5%        |
| 5   | Products KV cache `products:v{n}:...` (lines 2208, 2389, 2414, 2910, 2935)                   | 1800s    | Every distinct page/category/sort first-fetch | ~10%       |
| 6   | Shell + prebuilt-head + theme-lite KV (lines 670, 817, 896, 889, 970)                        | 30m–1h   | Every cold isolate                            | ~5%        |
| 7   | `active-slugs-7d` (line 4093)                                                                | 6h       | Cron miss                                     | ~3%        |
| 8   | Misc: spa-shell, domain map                                                                  | varies   | low                                           | ~2%        |


Workers requests: every page view = 1 HTML req + ~3–5 client `/api/*` reqs (products, store-info, prewarm). Heavy contributors:

- `useInfiniteProducts` triggers `/api/products?page=N` per scroll (already 50/page).
- `/api/page-view` fires on every navigation (SPA + storefront) → buffered, but still 1 Worker req each.
- Bots/crawlers (Googlebot, AhrefsBot, etc.) hit every URL and create the same warm/lock/store-info writes as humans.

# The Plan — 6 surgical changes to `docs/cloudflare-worker-current.js`

All changes are in the worker file. **You must redeploy the worker manually after edits** (per `mem://infrastructure/manual-deployment-policy`).

## Change 1 — Bump TTLs aggressively (single biggest lever)

Long TTLs = fewer re-writes when the cron tick or a cold isolate revisits the same key. Today most KV TTLs are 30 min – 1 hour. Bumping them does NOT hurt freshness because:

- Dashboard saves already call `/api/purge` which bumps `pv:{domain}` and busts the relevant keys.
- Store metadata changes (rename, domain, theme) are rare events (<1/day per store).


| Constant                                                | Current   | New               | Line   |
| ------------------------------------------------------- | --------- | ----------------- | ------ |
| `STORE_INFO_KV_TTL`                                     | 3600 (1h) | **86400** (24h)   | 1380   |
| `KV_DOMAIN_TTL`                                         | 3600      | **86400**         | 1285   |
| `store-id:` writes (lines 1577, 2866, 2882, 4030, 4038) | 3600      | **86400**         | inline |
| `PREBUILT_HEAD_KV_TTL`                                  | 1800      | **21600** (6h)    | 599    |
| `SPA_SHELL_KV_TTL`                                      | 1800      | **21600**         | 732    |
| `THEME_LITE_KV_TTL`                                     | 3600      | **21600**         | 868    |
| `PRODUCTS_KV_TTL`                                       | 1800      | **7200** (2h)     | 1076   |
| NOT_FOUND `store-info` write (line 1484)                | 30        | **1800** (30 min) | 1484   |
| `warm-lock` (line 2050)                                 | 300       | **1800** (30 min) | 2050   |


Expected impact: **−40 to −50% KV writes** (cron read-before-write skips far more keys, and warm-lock dedup window is 6× longer).

## Change 2 — Skip warm-lock writes when shell is already cached

`_warmFullHtmlInBackground` (line 2040) is invoked from many code paths. Today it always writes the lock first, then checks the early cache. Reverse the order: if `early-cache` already has full HTML, skip the lock entirely.

```js
// In _warmFullHtmlInBackground — move the early-cache check BEFORE the lock write
if (hostname) {
  const earlyKey = getEarlyCacheKey(hostname);
  const existing = await cache.match(earlyKey);
  if (existing) {
    const ds = existing.headers.get("X-Data-Source") || "";
    if (ds && ds !== "fast-shell" && ds !== "fast-shell-themed" && ds !== "streaming") return;
  }
}
// THEN check warm-lock + write lock
```

Expected: **−30% on `warm-lock` writes** (most invocations short-circuit before the put).

## Change 3 — Bot/crawler short-circuit BEFORE any KV writes

Bots (Googlebot, bingbot, AhrefsBot, SemrushBot, FacebookExternalHit, social previews) trigger the full HTML pipeline including `warm-lock`, `store-info`, and `store-id` writes. They visit every URL, often once.

Add a top-of-`fetch` guard:

```js
const ua = request.headers.get("User-Agent") || "";
const isBot = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slurp|bingbot|ahrefs|semrush|mj12|dotbot|petalbot/i.test(ua);
const isStorefrontHTML = pathname === "/" || /^\/[^./]+$/.test(pathname);
if (isBot && isStorefrontHTML) {
  // Serve cached HTML if present, otherwise fetch shell with NO warm/lock/KV writes
  const cached = await cache.match(getEarlyCacheKey(hostname));
  if (cached) return cached;
  // Pass a flag through the pipeline that disables all KV writes for this request
}
```

Add a `skipKvWrites` flag in the request context that wraps every `STORE_KV.put(...)` in:

```js
if (!ctx.skipKvWrites) env.STORE_KV.put(...)
```

Expected: **−15 to −20% writes & requests** (bots are ~30% of traffic for new stores).

## Change 4 — Coalesce cron writes harder

The cron at line 3958 runs every 30 min. Even with read-before-write, on a fresh deploy or if KV TTLs lapse, every store re-writes 4 keys. Two improvements:

a) **Skip cron entirely if `all-active-slugs` matches DB count and was written <12h ago** — store a `last-full-sync-ts` key (1 write/12h) and only do the full diff sync after that window.

b) **Reduce cron frequency from `*/30` to `*/60**` (hourly) once TTLs are 24h. Halves cron-driven writes immediately.

Expected: **−10% writes**.

## Change 5 — Client: drop the `/api/products` first-page fetch when shell already inlined products

The worker already injects `inlineProducts` into the HTML shell (`_getInlineProductsOrNull`). But `useInfiniteProducts.ts` (PAGE 0) still fires a `/api/products` request on mount. That's **1 wasted Worker request per first page view**, the single largest non-HTML request source.

Edit `src/hooks/useInfiniteProducts.ts`:

- On mount, check `window.__INLINE_PRODUCTS__` (already injected by worker).
- If present and matches the current category filter, seed the React Query cache with that data and skip the page-0 fetch.

Expected: **−25 to −35% Worker requests** (eliminates 1 req per visitor per Shop/Home page).

## Change 6 — Debounce `/api/page-view` aggressively + skip on bot UA

Today every SPA navigation fires a page-view ping. Two cuts:

- Client: **debounce** in `useFacebookPixel.ts` / page-view tracker — drop pings within 5s of the previous one (SPA users browsing fast).
- Worker: at the very top of the `/api/page-view` handler, check bot UA and return 204 immediately (no buffer write, no eventual KV/DB write).

Expected: **−15% Worker requests**.

# Combined Projected Impact (single store, 30-day month)


| Metric           | Today (projected) | After plan                                              | % of free tier |
| ---------------- | ----------------- | ------------------------------------------------------- | -------------- |
| KV Writes        | ~446k             | **~80–95k**                                             | **8–9%** ✅     |
| Workers Requests | ~2.75M            | **~1.4–1.6M**                                           | **14–16%** ✅   |
| KV Reads         | ~1.25M            | ~1.4M (slight ↑ from longer TTLs offsetting more reads) | ~14% ✅         |
| CPU ms           | ~3.17M            | ~2.0M (fewer warm cycles)                               | ~7% ✅          |


Both targets met with margin. At 5× ad spend you'd still be under 50%.

# Files Touched

- `docs/cloudflare-worker-current.js` — Changes 1–4, 6 (worker side)
- `src/hooks/useInfiniteProducts.ts` — Change 5 (skip page-0 fetch when inlined)
- One small edit in the page-view tracker (likely `src/hooks/useFacebookPixel.ts` or wherever `/api/page-view` is called) — Change 6 (client debounce)

No DB migrations. No new env vars. No breaking changes to storefront behavior.

# Rollout & Verification

1. Apply changes 1, 2, 3 first (worker-only, lowest risk) → redeploy worker manually → watch Cloudflare metrics for 48h.
2. Apply change 5 (client) → automatic deploy via Lovable.
3. Apply changes 4, 6 → redeploy worker.
4. Verify: KV write rate should drop within 30 min of worker redeploy. Pull a 7-day snapshot afterward — KV Writes should land at ~20–25k/week (down from 104k).

# Trigger to revisit

If a single store crosses **70k KV writes/month** or **1.5M Worker req/month**, re-audit with the same `rg` script and look for new write sources (likely cron drift or new Edge Function calls). do all safely