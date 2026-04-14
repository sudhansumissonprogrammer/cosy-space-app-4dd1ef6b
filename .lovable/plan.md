

# Cloudflare Worker Cold Start Optimization — v6.2.0

## Problem
Cold load takes 5-8s TTFB because the Worker blocks on origin shell fetch (2-4s) before sending any bytes to the browser. Multiple TTL and architectural issues compound the delay.

## Plan — 7 Fixes (ordered by impact)

### Fix 1 — Increase Shell & Storefront TTLs (Critical, saves 2-4s)
The SPA shell only changes on deploy, yet expires from KV after 1 hour. After expiry, a cold fetch to origin takes 2-4s.

**Changes in `docs/cloudflare-worker-current.js`:**
- `SPA_SHELL_KV_TTL`: 3600 → **86_400** (24h)
- `SPA_SHELL_CACHE_TTL`: 600 → **3_600** (1h)
- `MEM_SHELL_TTL`: 600_000 → **1_800_000** (30min)
- `KV_STOREFRONT_TTL`: 3600 → **14_400** (4h)
- `MEM_STOREFRONT_TTL`: 120_000 → **600_000** (10min)
- `CACHE_STOREFRONT_TTL`: 600 → **1_200** (20min)
- `STOREFRONT_PREFETCH_TIMEOUT_MS`: 1_000 → **1_500**

### Fix 2 — Instant Skeleton Fast Path (Critical, perceived instant load)
If `_memShell` is empty (true cold start), return a minimal themed skeleton HTML immediately instead of blocking on origin fetch. Warm shell in background via `ctx.waitUntil`.

**New function**: `buildInstantSkeleton(slug, bgColor, themeLite)` — generates a minimal HTML page with the store's theme CSS, skeleton UI, and `__STORE_SLUG__` script tag.

**In subdomain handler** (line ~2791): Before `await _getSlugIndex`, check `!_memShell`. If cold, check memory theme cache, build skeleton, fire background warm, return immediately.

**In custom domain handler** (line ~2896): Same pattern after slug resolution.

### Fix 3 — Reduce Origin Timeout (High, eliminates 8s worst case)
`ORIGIN_TIMEOUT_MS`: 8_000 → **3_500**

### Fix 4 — Remove Blocking `await _getSlugIndex(env)` (High, saves ~50-150ms)
Line 2791: `await _getSlugIndex(env)` blocks the critical path but its result is never used.

**Change to**: `_getSlugIndex(env).catch(() => {})` — fire-and-forget.

### Fix 5 — Reduce stale-while-revalidate on warmed HTML (Medium)
In `_warmFullHtmlInBackground` and cron: Change `stale-while-revalidate=7200` → **600** (10min) to match cron frequency, ensuring fresher content.

### Fix 6 — Skeleton Fallback in Cron (Medium, safety net)
If `prefetchStorefrontData` fails for a store during cron, cache a themed skeleton HTML instead of leaving the store cold. Uses the existing `buildSkeleton` + `buildThemeCssFromConfig` functions.

### Fix 7 — Version Bump
`WORKER_VERSION`: "6.1.0" → **"6.2.0"**

---

## Expected Results

| Fix | Change | Gain |
|-----|--------|------|
| #1 | TTLs raised | 2-4s saved (shell stays in KV/Cache) |
| #2 | Instant skeleton | First byte <50ms on true cold start |
| #3 | Origin timeout 8→3.5s | Eliminates 8s worst case |
| #4 | Remove blocking await | ~50-150ms saved |
| #5 | SWR 7200→600 | Fresher cached HTML |
| #6 | Cron skeleton fallback | No store left cold |

**Combined**: Cold start TTFB drops from 5-8s → <100ms (skeleton) with full content loading in 1-2s background.

## Deployment
After approval, I will update `docs/cloudflare-worker-current.js` with all fixes. You then deploy the updated Worker to Cloudflare manually.

