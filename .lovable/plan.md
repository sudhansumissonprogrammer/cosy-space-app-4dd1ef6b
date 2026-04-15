

# Worker v6.2.0 Bug Fixes — 5 Issues

## Issue A — Critical: Replace blind `setTimeout` reload with smart polling

**File:** `docs/cloudflare-worker-current.js`, lines 401-403

Replace the `setTimeout(function(){location.reload();},2500)` in `_buildInstantSkeletonPage()` with a polling mechanism that checks `X-Data-Source` header before reloading. After 3 failed attempts (6s), reload unconditionally as a last resort.

```javascript
var attempts = 0;
function checkReady() {
  attempts++;
  if (attempts >= 3) { location.reload(); return; }
  fetch(location.href, { method: 'HEAD', cache: 'no-store' })
    .then(function(r) {
      var src = r.headers.get('X-Data-Source') || '';
      if (src && src !== 'instant-skeleton') {
        location.reload();
      } else {
        setTimeout(checkReady, 2000);
      }
    })
    .catch(function() { setTimeout(checkReady, 2000); });
}
setTimeout(checkReady, 2000);
```

## Issue B — Medium: Align prebuilt head TTLs with shell TTLs

**File:** `docs/cloudflare-worker-current.js`, lines 412-413

- `PREBUILT_HEAD_KV_TTL`: 3600 → **86_400** (match shell KV TTL)
- `PREBUILT_HEAD_CACHE_TTL`: 600 → **3_600** (match shell Cache TTL)

## Issue C — Medium: Eliminate duplicate `resolveDomain()` for custom domains

**File:** `docs/cloudflare-worker-current.js`, lines 2992-3038

When `!_memShell` and `resolveDomain()` returns null (no slug found), currently falls through to a second `Promise.all([resolveDomain(...), ...])`. Fix: if the skeleton path's `resolveDomain` returns null, return a 404 immediately instead of calling it again.

If skeleton path returns a slug but we still fall through (shouldn't happen since we return), the `Promise.all` block at line 3035 should reuse the already-resolved slug instead of calling `resolveDomain` again.

## Issue D — Low: Update comment for `STOREFRONT_PREFETCH_TIMEOUT_MS`

**File:** `docs/cloudflare-worker-current.js`, line 94

Clarify that this timeout only applies to the warm path (when `_memShell` exists), since the instant skeleton path bypasses `serveStreamedHtml` entirely.

## Issue E — Low: Increase `all-active-slugs` KV TTL from 600s to 3600s

**File:** `docs/cloudflare-worker-current.js`

Three locations to update:
- Line 2478: `expirationTtl: 600` → `3_600`
- Line 2483: `expirationTtl: 600` → `3_600`
- Line 3218: `expirationTtl: 600` → `3_600`

Also update `_slugIndexExpiresAt` memory TTL at line 3221 from `300_000` (5min) to `1_800_000` (30min) for consistency.

---

## Version bump
`WORKER_VERSION`: "6.2.0" → **"6.2.1"**

## Deployment
After approval, all changes go into `docs/cloudflare-worker-current.js`. You deploy manually to Cloudflare.

