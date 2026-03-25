

# Edge HTML Caching Upgrade to v2.2

## What's Changing

The current Worker (v2.1) already implements edge caching via `cachedFetch()`, but it has some inconsistencies. This upgrade cleans up the caching flow for clarity, correctness, and the specified TTL.

## Changes in `docs/cloudflare-worker-current.js`

### 1. Bump version
- `WORKER_VERSION` → `"2.2"`

### 2. Guard: only cache GET requests
- Add `request.method !== "GET"` check at the top of `cachedFetch()` — non-GET requests bypass cache entirely and go straight to origin/injection.

### 3. Standardize Cache-Control TTL
- All cached HTML responses get: `public, max-age=60, stale-while-revalidate=600`
- Update `fetchAndInjectSlug` (line 416) which currently uses `max-age=120` → change to `max-age=60`
- Update `proxyToOrigin` (line 279-281) HTML cache-control from `max-age=120` → `max-age=60`

### 4. Ensure X-Cache-Status on all paths
- The current code already adds diagnostic headers via `addDiagnosticHeaders()`, but `cachedFetch` returns from some paths without them (e.g., the root domain call on line 760 double-wraps). Clean up so every exit path from `cachedFetch` consistently returns `HIT`, `MISS`, `MISS-INVALID`, `BYPASS`, or `STALE-FALLBACK`.

### 5. Prevent body stream double-consumption
- In the cache-miss path (lines 498-512), the current code already uses `res.clone()` correctly. No change needed, but add a safety comment.

### 6. Skip caching non-200 responses
- Add explicit `res.status === 200` check (currently uses `res.ok` which covers 200-299; tighten to exactly 200 for HTML).

### Summary of file edits
- **`docs/cloudflare-worker-current.js`**: ~15 lines changed across 4 locations (version bump, GET guard, TTL standardization, status tightening)

