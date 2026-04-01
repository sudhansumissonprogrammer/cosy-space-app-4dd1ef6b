

# Worker v4.7 — Eliminate Supabase Cold Start Completely

## What's Actually There (Correcting the Diagnosis)

The `scheduled()` handler **already exists** at line 2500. It already:
- Pings Supabase every 5 min to keep the DB connection pool warm
- Warms the SPA shell cache
- Pre-loads 50 most recent stores into KV

**So the cron IS working.** The real remaining issues are:

1. **Only 50 stores are warmed** — stores beyond the top 50 still hit DB on first request
2. **No KV-first early rejection** — unknown/invalid slugs still go through the full `_resolveStoreInfo` waterfall (Memory → Cache API → KV → DB) inside the parallel `Promise.all` block, adding ~2-4s
3. **Cron only warms the DB connection** — it doesn't warm the actual storefront shell caches for individual stores

## Plan (Worker v4.7)

### Step 1: Warm ALL active stores in cron (not just 50)

In the `scheduled()` handler, change:
```
limit=50 → remove limit (or set limit=500)
```
Also add pagination if there are >1000 stores. This ensures **every** active store has a KV entry.

### Step 2: Add KV-first early rejection for subdomains

Before the expensive `Promise.all` block (line 2349), add a fast KV check:

```javascript
// FAST PATH: If KV is available and slug is NOT in KV, instant 404
if (env?.STORE_KV) {
  const kvCheck = await env.STORE_KV.get(`store-info:${slug}`);
  if (kvCheck) {
    const parsed = JSON.parse(kvCheck);
    if (parsed.__nf) {
      // Known non-existent store → instant 404 (<20ms)
      return instant404(slug);
    }
  }
}
```

This skips the entire `Promise.all` for known-bad slugs. For known-good slugs, the data is already in KV so `_resolveStoreInfo` will be fast anyway.

### Step 3: Warm individual store shells in cron

For the top 20 most active stores, also pre-warm their full HTML shell by making a lightweight fetch to their subdomain URL. This ensures the Cache API has the full rendered HTML ready.

### Step 4: Store a "slug index" in KV

During cron, write a master key `all-slugs` containing a Set of all active slugs. Then in the request path, check this set first — if the slug isn't in it, instant 404 without any DB/KV per-key lookup.

```javascript
// In cron: store all slugs as a JSON array
await env.STORE_KV.put("all-active-slugs", JSON.stringify(allSlugs), { expirationTtl: 600 });

// In request: single KV read to validate
const allSlugs = await env.STORE_KV.get("all-active-slugs", { type: "json" });
if (allSlugs && !allSlugs.includes(slug)) {
  return instant404(slug); // <20ms
}
```

## Expected Impact

| Scenario | Before (v4.6) | After (v4.7) |
|---|---|---|
| Known store, warm cache | ~300ms | ~300ms (same) |
| Known store, cold cache | 4-5s | ~500ms (KV hit → skip DB) |
| Unknown/invalid slug | 2-4s (DB roundtrip) | <50ms (KV slug index) |
| New store (not yet in KV) | 4-5s | ~500ms (next cron populates) |

## Files Changed

- `docs/cloudflare-worker-current.js` — all changes in the Worker only

## Technical Details

- The "slug index" KV key is a single JSON array (~5KB for 500 stores). One KV read (~10ms) replaces the entire `_resolveStoreInfo` chain for rejection.
- Memory cache of the slug index (refreshed every 5 min from KV) makes repeated checks essentially free.
- No Supabase or app code changes needed.

