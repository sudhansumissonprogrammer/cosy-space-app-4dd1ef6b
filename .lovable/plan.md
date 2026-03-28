

# Cloudflare Worker KV Optimization Plan

## Problem Analysis

The current Worker has **KV-first** ordering in critical paths, causing excessive KV reads even when Cache API has data. Here are the specific issues:

### Current KV Reads Per Request (Worst Case)

| Path | KV Reads | Issue |
|------|----------|-------|
| `getSpaShell()` | 1 | KV checked BEFORE Cache API |
| `prefetchStorefrontData()` | 1 | KV checked BEFORE Cache API |
| `resolveDomain()` | 1 | KV checked BEFORE Cache API |
| `_resolveStoreId()` (products) | 1 | KV checked after in-memory only |
| Products API data | 1 | Correct order (Cache → KV) |
| Background revalidation | 2-3 | Runs on EVERY cache HIT |
| **Total per cold request** | **5-7** | |
| **Total per warm HIT** | **2-3** | Background reval still reads KV |

### Root Causes
1. **`getSpaShell`** (line 389-411): Checks KV first, Cache API second — reversed from optimal
2. **`prefetchStorefrontData`** (line 476-500): Same problem — KV before Cache API
3. **`resolveDomain`** (line 200-261): Same problem — KV before Cache API
4. **Background revalidation on every HIT** (line 1624-1640): Even when returning a cached response, `fetchAndInjectSlug` runs in background, triggering 2-3 KV reads
5. **Short KV TTLs**: Shell at 60s, products at 300s — forces frequent re-writes

---

## Optimized Architecture

### New Request Flow
```text
User → Worker → Early Cache (full HTML) → DONE (0 KV reads)
                     ↓ MISS
              Cache API (per-layer) → DONE (0 KV reads)
                     ↓ MISS
              KV (single consolidated read) → DONE (1 KV read)
                     ↓ MISS
              DB → write Cache + KV → DONE
```

---

## Changes (Single File: `docs/cloudflare-worker-current.js`)

### Change 1: Reverse cache order in `getSpaShell` — Cache API FIRST, KV second

Currently lines 389-411 check KV → Cache API. Swap to Cache API → KV. This eliminates 1 KV read on every warm colo.

### Change 2: Reverse cache order in `prefetchStorefrontData` — Cache API FIRST, KV second

Lines 476-500 check KV → Cache API. Swap order. Eliminates 1 KV read per warm request.

### Change 3: Reverse cache order in `resolveDomain` — Cache API FIRST, KV second

Lines 200-261 check KV → Cache API. Swap so Cache API is checked first. Only matters for custom domains but still saves KV reads.

### Change 4: Throttle background revalidation to prevent KV reads on every HIT

Currently line 1624 runs `fetchAndInjectSlug` (which reads KV 2-3 times) on EVERY cache hit. Add a time-based gate: only revalidate if the cached response is older than 30 seconds. Use a lightweight in-memory Map to track last revalidation time per hostname+path.

### Change 5: Skip KV writes in background refresh when data hasn't changed

In `_refreshProductsBackground`, skip the KV write if the data matches what's already cached. This reduces KV write operations.

### Change 6: Increase KV TTLs

| Key | Current TTL | New TTL |
|-----|-------------|---------|
| `spa-shell:v1` | 60s | 3600s (1 hour) |
| `storefront:{slug}` | 1800s | 3600s (1 hour) |
| `products:{domain}` | 300s | 1800s (30 min) |
| `store-id:{domain}` | 1800s | 3600s (1 hour) |
| `domain:{domain}` | 3600s | 3600s (unchanged) |

Purge endpoints already exist to invalidate on updates, so longer TTLs are safe.

### Change 7: Consolidate KV reads in `fetchAndInjectSlug`

Instead of two parallel calls (`getSpaShell` + `prefetchStorefrontData`) each doing their own KV lookup, add a combined KV key `bundle:{slug}` that stores both shell + storefront data. Single KV read replaces two.

### Change 8: Add revalidation cooldown map

```text
const revalCooldowns = new Map(); // hostname+path → lastRevalTime
const REVAL_COOLDOWN_MS = 30_000; // 30 seconds
```

Only trigger background revalidation if cooldown has elapsed, preventing repeated KV reads from stale-while-revalidate on every request.

---

## Expected KV Usage After Optimization

| Scenario | Before (KV reads) | After (KV reads) | Reduction |
|----------|-------------------|-------------------|-----------|
| Cache HIT (early exit) | 2-3 (background reval) | 0 (cooldown gate) | 100% |
| Cache API warm, KV skip | 2-3 | 0 | 100% |
| Full cache miss | 5-7 | 1-2 | 70-85% |
| Products API (warm) | 1 + 1 background | 0 | 100% |
| Products API (miss) | 2-3 | 1 | 50-66% |

**Overall estimated reduction: 85-90%** since the majority of requests are cache HITs with background revalidation being the main KV consumer.

---

## Files to Modify

1. **`docs/cloudflare-worker-current.js`** — All Worker changes (reorder cache layers, add cooldown, increase TTLs, add bundle key)

No changes needed to edge functions or client-side code. The prewarm and purge systems continue to work as-is — they just write to both Cache API and KV, which is correct.

