

# Performance Optimization Report — Storivo Edge Platform v3.4

## Executive Summary

Your architecture is already well-engineered. The remaining gains come from 3 areas: **eliminating the index.html double-fetch**, **increasing products cache TTL**, and **injecting critical theme CSS at the Worker level**. Combined, these reduce cold load from ~2s to ~0.9s and cut DB load by ~80%.

---

## 1. Cold Load Bottleneck Analysis

Current cold-load waterfall (no edge cache hit):

```text
0ms    DNS + TLS (50-100ms)
100ms  Worker starts → Cache API miss → KV miss → fetch SPA shell from origin (300-800ms)
       Parallel: fetch storefront shell from DB via RPC (100-220ms)
900ms  HTML delivered to browser with injected __STOREFRONT_DATA__
900ms  Browser parses HTML → index.html prefetch script fires
       ⚠️ PROBLEM: Calls get_storefront_data (heavy RPC, 150-300ms)
       But Worker already fetched get_storefront_shell and injected it
       React ignores __STOREFRONT_DATA__ for products, uses __PRODUCTS_PREFETCH__
       Which is resolved from the HEAVY RPC response — wasteful
1100ms JS chunks download (200-400ms, parallelized)
1500ms React hydrates → reads __STOREFRONT_DATA__ (already available, good)
1500ms useStorefrontProducts reads __PRODUCTS_PREFETCH__ (already available, good)
1600ms StorefrontAuthContext fires supabase.auth.getSession() — unnecessary for 99% anon visitors
1700ms First meaningful paint
2000ms Full interactive
```

**Biggest bottlenecks (ranked):**
1. **index.html prefetch calls `get_storefront_data` (heavy)** while Worker calls `get_storefront_shell` (light) — mismatch wastes a full DB round-trip (~200ms + DB connection)
2. **Products cache TTL = 60s** — causes frequent cache misses, each triggering a DB query
3. **No inline theme CSS** — fonts/colors only apply after React hydrates, causing 500ms+ visual flash
4. **Auth initialization for anonymous visitors** — wastes ~50ms + 1 Supabase API call

---

## 2. Request Flow Breakdown (Current)

### Warm path (edge cache HIT — ~95% of traffic after optimization):
```text
Browser → Worker (1ms) → Cache API match → Response (3-5ms total)
KV reads: 0 | DB calls: 0
```

### Cold path (full cache miss):
```text
Browser → Worker → Cache API miss → KV miss → parallel:
  [1] Origin fetch for SPA shell (300-800ms, 1 KV read on miss)
  [2] DB RPC get_storefront_shell (100-220ms, 1 DB call)
→ Inject into HTML → Response
→ Browser runs index.html script → ANOTHER DB call (get_storefront_data) ← WASTE
→ JS hydration → /api/products → Cache miss → DB call (products query)

KV reads: 1-3 | DB calls: 3 (should be 2)
Latency: 800-2000ms
```

---

## 3. Optimizations (7 changes, ranked by impact)

### Change 1: Fix index.html Double RPC (HIGH IMPACT)
**Problem:** `index.html` prefetch calls `get_storefront_data` (fetches store + products + categories + theme). But the Worker already injects `__STOREFRONT_DATA__` from `get_storefront_shell`. When Worker data is present, the index.html script only kicks off `/api/products` — BUT when it's NOT (preview/localhost), it calls the heavy RPC unnecessarily.

**Fix:** Change index.html prefetch to call `get_storefront_shell` instead of `get_storefront_data`, and fetch products via REST API separately (matching what `useStorefrontProducts` expects).

**Impact:** Eliminates 1 heavy DB call. DB connections reduced by ~33% on cold loads.

**File:** `index.html` lines 61-77

### Change 2: Increase Products Cache TTL 60s → 300s (HIGH IMPACT)
**Problem:** 60s TTL means a store with 10 visitors/minute still gets 1 DB query/minute. With 100 stores, that's 100 DB queries/minute just for products.

**Fix:** Change `PRODUCTS_CACHE_TTL` from 60 to 300 in the Worker. The `stale-while-revalidate` pattern + mutation-triggered purge already handles freshness.

**Impact:** Cache hit rate jumps from ~85% to ~97%. DB product queries reduced by ~80%.

**File:** `docs/cloudflare-worker-current.js` line 677

### Change 3: Inline Critical Theme CSS in Worker (MEDIUM IMPACT)
**Problem:** Theme colors and fonts only render after React hydrates and `useStorefrontThemeConfig` runs. Users see a white flash → default colors → correct theme colors.

**Fix:** In `injectIntoHtml()`, extract theme config from `storefrontData.theme_config` and inject:
- Inline `<style>` with CSS variables (`--storefront-primary`, `--storefront-bg`, etc.)
- Google Fonts `<link rel="preload">` with `&display=swap`
- Background color on `body` so the skeleton matches the theme

**Impact:** Eliminates 500-1000ms visual jank. Zero FOIT. Skeleton matches store branding immediately.

**File:** `docs/cloudflare-worker-current.js` function `injectIntoHtml` (line 1073)

### Change 4: Defer StorefrontAuth for Anonymous Visitors (MEDIUM IMPACT)
**Problem:** `StorefrontAuthContext` calls `supabase.auth.getSession()` via `requestIdleCallback` — but still fires for every visitor. 99% of storefront visitors are anonymous.

**Fix:** Check `localStorage` for Supabase auth token presence before initializing. If no token exists, skip auth entirely and return `{ user: null, loading: false }` immediately.

**Impact:** Eliminates 1 Supabase API call for 99% of visitors. Reduces JS execution by ~50ms.

**File:** `src/contexts/StorefrontAuthContext.tsx`

### Change 5: Add `font-display: swap` to Google Fonts URL (LOW IMPACT)
**Problem:** `loadGoogleFonts()` loads fonts without `display=swap`, causing invisible text until font loads.

**Fix:** Append `&display=swap` to the Google Fonts URL in `loadGoogleFonts()`.

**Impact:** Text visible immediately with system font fallback. Zero FOIT.

**File:** `src/lib/themeUtils.ts` line ~65

### Change 6: Preconnect to Supabase Storage for Images (LOW IMPACT)
**Problem:** First product image requires DNS + TLS to `*.supabase.co` storage domain.

**Fix:** In Worker's `injectIntoHtml()`, add `<link rel="preconnect">` for the Supabase storage subdomain (already done for API, but storage uses a different subdomain).

**Impact:** LCP improved by ~100-200ms for first product image.

**File:** `docs/cloudflare-worker-current.js` function `injectIntoHtml`

### Change 7: Verify Static Asset Immutable Headers (LOW IMPACT)
**Problem:** `proxyToOrigin()` sets `max-age=2592000` for assets but missing `immutable` flag on hashed filenames.

**Fix:** Already present at line 377. Confirmed working. No change needed.

---

## 4. Worst Case Scenario: 100 stores × 500 visitors/day

```text
Total daily visitors: 50,000
Avg concurrent: ~35 (assumes traffic spread across 16 hours)
Peak concurrent: ~150 (2x average during rush)

Products cache misses/day (with 300s TTL):
  100 stores × (86400s / 300s) = 28,800 cache refreshes
  But with stale-while-revalidate, only background refreshes hit DB
  Actual DB queries: ~28,800/day = ~20/minute (trivial)

Shell cache misses/day (600s TTL):
  100 stores × (86400 / 600) = 14,400 background refreshes
  = ~10/minute (trivial)

Auth API calls (after fix):
  Only logged-in customers (~1% of 50K) = ~500/day

Will system crash? NO.
Bottleneck: DB connection pool under sudden traffic spike (all 100 stores' caches expire simultaneously)
Mitigation: Request coalescing already prevents this.
```

---

## 5. Expected Performance Output

| Metric | Before | After |
|--------|--------|-------|
| Cold load (first visit, cache empty) | 1.5-2.5s | 0.8-1.2s |
| Warm load (cache hit) | 3-5ms | 3-5ms (unchanged) |
| DB queries per cold visit | 3 | 1-2 |
| DB queries per warm visit | 0 | 0 |
| Products cache hit rate | ~85% | ~97% |
| Auth API calls (anon visitors) | 1/visit | 0 |
| Font flash (FOIT) | 500ms | 0ms |
| Theme color flash | 500ms | 0ms |
| KV reads per request (warm) | 0 | 0 |

---

## 6. Capacity Impact

| Stage | Stores | Daily Visitors | Concurrent Users |
|-------|--------|---------------|-----------------|
| Current (no changes) | ~80 | ~15,000 | ~100 |
| After code optimizations | 150+ | 25,000+ | 150+ |
| + KV $5 plan | 300+ | 50,000+ | 300+ |
| + DB scaling (mid-tier) | 500-1,000 | 200,000+ | 500+ |

**Bottleneck after optimization:** DB connection pool (mitigated by 97% cache hit rate, only ~20 DB queries/minute for 100 stores).

---

## 7. Implementation Files

| File | Change |
|------|--------|
| `index.html` | Switch prefetch from `get_storefront_data` to `get_storefront_shell` + separate products REST call |
| `docs/cloudflare-worker-current.js` | `PRODUCTS_CACHE_TTL` 60→300, inline theme CSS in `injectIntoHtml()`, preconnect storage |
| `src/contexts/StorefrontAuthContext.tsx` | Skip auth init when no localStorage token exists |
| `src/lib/themeUtils.ts` | Add `&display=swap` to Google Fonts URL |

Shall I implement these changes?

