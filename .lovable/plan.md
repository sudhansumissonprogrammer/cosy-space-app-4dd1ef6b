

# Cloudflare Worker v3.4 — Final Scaling Optimization

## Current State Assessment

The v3.3 Worker already has Cache-First ordering and revalidation cooldowns. Here's what remains:

| Requirement | Status | Action |
|---|---|---|
| Full HTML edge cache | Done | Minor TTL tuning |
| Global revalidation lock | Partial (in-memory only) | Need KV-based lock |
| Cache tagging + per-store purge | Missing | Add store-scoped purge |
| Consolidated single KV read | Partial | `_resolveStoreId` still reads KV separately |
| Pre-warm all stores | Done | Already comprehensive |
| Remove KV from products flow | Not done | KV still in products hot path (lines 814-835) |
| Cache TTL strategy | Mostly done | Align remaining values |
| Edge memory reuse | Partial | `_resolveStoreId` called redundantly in background |

## Changes to `docs/cloudflare-worker-current.js`

### Change 1: KV-Based Global Revalidation Lock (STEP 2)

Replace in-memory `revalCooldowns` Map with a KV-based lock for cross-region coordination. The in-memory map only prevents revalidation within the same isolate — multiple colos can still trigger parallel revalidation.

**New function**: `shouldRevalidateGlobal(key, env)` — checks `reval-lock:{key}` in KV with 30s TTL. If key exists, skip. If not, set it and proceed. Falls back to in-memory check if KV unavailable.

This ensures only ONE background refresh globally across all Cloudflare colos.

### Change 2: Remove KV from Products Normal Flow (STEP 6)

Currently `handleProductsApi` checks KV on Cache API miss (lines 814-835). Change this to go directly to DB on cache miss, skipping KV entirely in the normal path. KV remains only in the fallback chain (`_fallbackProducts`).

New flow: `Cache API → DB (with coalescing) → write Cache API only`

KV writes for products will only happen during pre-warm, not on user requests.

### Change 3: Stop Writing Products to KV on User Requests (STEP 6)

In `buildProductResponse` (line 939), remove the KV write. Products KV is only populated during pre-warm. This eliminates KV writes on every cache miss.

In `_refreshProductsBackground`, remove the KV comparison read + write (lines 982-993). Only update Cache API.

### Change 4: Per-Store Cache Purge (STEP 3)

Currently `purge-shell` deletes the global SPA shell KV key, which affects ALL stores. Add store-scoped early cache purge:

- On purge, delete `edge-html/{slug}.storivo.in/` and `edge-html/{customDomain}/` entries
- Keep the global shell purge for actual shell updates only
- Add a new `/api/purge-store` endpoint that purges only that store's caches (products + storefront data + early HTML) without touching the global shell

### Change 5: Cache API-Only for `_resolveStoreId` (STEP 4, 8)

Currently `_resolveStoreId` goes in-memory → KV → DB. Add Cache API as the second layer (after in-memory, before KV) to reduce KV reads for store ID resolution during background refreshes.

### Change 6: Bump Version and TTL Alignment (STEP 7)

- `PRODUCTS_CACHE_TTL`: 60s (keep — products change frequently)
- `CACHE_STOREFRONT_TTL`: 600s (keep — store config changes rarely)
- `SPA_SHELL_CACHE_TTL`: 300s → 600s (shell changes even less frequently)
- HTML early cache: keep 300s max-age with stale-while-revalidate
- Version bump to 3.4

## Technical Details

### KV-Based Revalidation Lock
```text
async function shouldRevalidateGlobal(key, env) {
  // 1. In-memory gate first (free)
  if (!shouldRevalidate(key)) return false;
  
  // 2. KV lock (cross-region, ~5ms)
  if (env?.STORE_KV) {
    const lockKey = `reval-lock:${key}`;
    const existing = await env.STORE_KV.get(lockKey);
    if (existing) return false;
    await env.STORE_KV.put(lockKey, "1", { expirationTtl: 30 });
  }
  return true;
}
```

This uses 1 KV read per revalidation check (only when in-memory cooldown passes), and the 30s TTL auto-expires the lock.

### Products Flow (Before vs After)
```text
BEFORE: Cache API → KV → DB → write Cache + KV
AFTER:  Cache API → DB → write Cache only
        (KV only in fallback + prewarm)
```

### Per-Store Purge Endpoint
```text
POST /api/purge-store?slug=mystore
Purges:
  - edge-html/{slug}.storivo.in/*
  - edge-html/{customdomain}/*  
  - storefront-data/{slug}
  - products:{domain}
  - KV storefront:{slug}
Does NOT purge global SPA shell
```

## Expected Results

| Metric | v3.3 | v3.4 |
|---|---|---|
| KV reads per warm request | 0 (in-memory gate) | 0 (same) |
| KV reads per revalidation | 2-3 (per colo) | 1 (global lock check) |
| KV reads for products | 1 (on cache miss) | 0 (direct to DB) |
| KV writes per products request | 1 | 0 (prewarm only) |
| Cross-region duplicate revalidation | Yes | No (KV lock) |
| Purge scope | Global shell | Per-store |
| Cache hit rate | ~90-95% | ~95-99% |

## Files to Modify

1. **`docs/cloudflare-worker-current.js`** — All 6 changes above

