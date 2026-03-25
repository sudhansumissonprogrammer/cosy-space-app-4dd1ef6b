

# Honest Performance Assessment + Actionable Plan

## The Truth About Your 2-Second Target

**Your Cloudflare Worker edge caching is already correctly implemented.** It has cache-first with stale-while-revalidate, tenant validation, background refresh — all properly done. The 1.9s TTFB you measured was a **cache MISS** (first visit or after 60s TTL expires). On a cache HIT, TTFB should already be ~50-200ms.

**The Recharts problem doesn't exist.** Dashboard.tsx imports recharts, but it's behind two lazy() boundaries (App → AuthRoutes → Dashboard). It never loads on storefront. The previous audit was incorrect.

**Realistic targets:**
- Cache HIT (repeat visitors, warm edge): **~1.5-2s total load** — achievable now
- Cache MISS (cold, first visitor to that edge node): **~3-4s** — this is physics (origin round-trip)
- Sub-2s on cold MISS: **not achievable** without SSR or moving to edge rendering, which is an architecture change far beyond scope

## What's Actually Slow (and Fixable)

There are **3 real remaining wins**, totaling ~800-1200ms savings:

### Fix 1: Increase HTML Cache TTL (saves ~1.5s on more requests)

**Problem:** `max-age=60` means cache expires every minute. Most visitors hit a MISS.
**Fix:** Increase to `max-age=300, stale-while-revalidate=3600` in the Worker. The HTML is an SPA shell — it's identical for all visitors. Stale-while-revalidate keeps serving cached while refreshing in background.

**File:** `docs/cloudflare-worker-production.js`
- Line 280: Change `max-age=60` → `max-age=300, stale-while-revalidate=3600`
- Line 421: Same change
- This means 5 minutes of guaranteed cache HIT instead of 1 minute, with 1-hour stale serving

**Impact:** Converts 80%+ of MISS requests into HITs. TTFB drops from 1.9s to ~100ms for most visitors.

### Fix 2: Prefetch Storefront Data in Worker with Longer Cache (saves ~500ms)

**Problem:** The Worker prefetches storefront data but with a 1.5s timeout. If it times out, React has to fetch again.
**Fix:** Cache the storefront data response at the edge separately with a 5-minute TTL, so the Worker can inject it from cache instantly without hitting Supabase.

**File:** `docs/cloudflare-worker-production.js` — `prefetchStorefrontData` function
- Add Cache API lookup before hitting Supabase
- Cache successful responses for 300 seconds
- On cache HIT: inject data instantly (0ms vs 500-1500ms)

```text
async function prefetchStorefrontData(slug, ctx) {
  const cacheKey = new Request(`https://cache/storefront-data/${slug}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  // Fresh fetch with timeout...
  const data = await fetchFromSupabase(slug);
  if (data) {
    ctx.waitUntil(cache.put(cacheKey, new Response(
      JSON.stringify(data),
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    )));
  }
  return data;
}
```

**Impact:** Storefront data injection goes from 500-1500ms to ~0ms on warm cache.

### Fix 3: Add `modulepreload` for Theme-Specific Chunks (saves ~300ms)

**Problem:** The Worker already extracts the entry JS file for modulepreload, but doesn't preload the framework/router/supabase chunks. Browser discovers them only after parsing the entry chunk.
**Fix:** Extract all chunk references from the HTML and add modulepreload hints in the Worker injection.

**File:** `docs/cloudflare-worker-production.js` — `fetchAndInjectSlug` function (around line 411-417)
```text
// Extract ALL script chunks, not just entry
const chunkMatches = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)];
let modulePreloads = "";
for (const m of chunkMatches) {
  modulePreloads += `<link rel="modulepreload" href="${m[1]}" />\n`;
}
```

**Impact:** Browser starts downloading all chunks in parallel from the first byte of HTML, saving ~300ms of discovery time.

## Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `docs/cloudflare-worker-production.js` | Increase HTML cache TTL to 300s/3600s SWR | 80% fewer cache MISSes |
| `docs/cloudflare-worker-production.js` | Cache prefetched storefront data at edge | 0ms data injection on warm |
| `docs/cloudflare-worker-production.js` | Modulepreload all JS chunks | ~300ms faster chunk loading |

## Expected Results After Fixes

| Scenario | Before | After |
|----------|--------|-------|
| Cache HIT (most visitors) | ~3-4s | **~1.5-2s** |
| Cache MISS (cold edge) | ~5s | **~3-3.5s** |
| Repeat visitor (same session) | ~2s | **~1s** |

## What Won't Help (Don't Waste Time On)

- **Removing Recharts** — it doesn't load on storefront already
- **More bundle splitting** — chunks are already well-split at 5 pieces
- **CSS splitting** — Vite already does cssCodeSplit, and your CSS is Tailwind (already optimized)
- **Image optimization** — already done with 400/800 variants
- **More prefetch/preconnect** — Worker already injects these

The single highest-impact change is **Fix 1** (longer cache TTL). After deploying the updated Worker, most real users will see ~1.5-2s loads because they'll hit cached HTML at the edge.

