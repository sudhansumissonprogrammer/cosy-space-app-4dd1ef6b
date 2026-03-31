

# Fix: Non-Existent Subdomains Taking Same Load Time as Real Stores

## Root Cause Analysis

When you visit `abc.storivo.in` (non-existent store), here's what happens step-by-step:

**Worker side (lines 2128-2166):**
1. Worker detects subdomain, extracts slug `abc`
2. Runs THREE parallel operations: `getCustomDomainForSlug(slug)`, `handleSeoFiles()`, `handleBot()` -- all hit cache/KV/DB
3. Then calls `fetchAndInjectSlug()` which does THREE more parallel fetches: `getSpaShell()`, `_getThemeLite()`, `getPrebuiltHead()`
4. Worker injects `window.__STORE_SLUG__="abc"` into HTML and returns it with a skeleton

**The Worker never checks if the store exists.** It blindly injects the slug and serves the full SPA shell with skeleton. It doesn't know or care if "abc" is a real store.

**Client side (StorefrontLayout.logic.ts):**
1. React boots, sees `window.__STORE_SLUG__="abc"`, calls `get_storefront_shell` RPC
2. RPC returns null/empty (store doesn't exist)
3. `useStorefront` resolves with `store = null`
4. `StorefrontShell` shows `<StorefrontNotFound>` -- but only after full React hydration

**Timeline for non-existent store:** Worker fetch (~1-2s) + JS download/parse (~2-3s) + React hydrate + RPC call (~1-2s) = **~5s** before "Store not found" appears.

**Timeline for real store:** Same ~5s, but the store actually renders. The time is identical because the Worker does the same work regardless.

## The Fix (Two Parts)

### Part 1: Worker-Level Store Existence Check (Primary Fix)

In the subdomain handler (line 2128), **check if the store exists before serving the full SPA**. If the store doesn't exist, return an instant static "Store Not Found" HTML page -- no SPA, no JS download, no React hydration needed.

```text
Current flow:
  subdomain request → inject slug → serve full SPA → React boots → RPC → "not found"
  (~5 seconds)

New flow:
  subdomain request → check store exists? → NO → instant static 404 HTML
  (~200ms)
```

**How:** The `prefetchStorefrontData(slug)` call already happens in `_warmFullHtmlInBackground`. We move a lightweight store-existence check earlier. The `_resolveStoreId` function already does exactly this (checks if a store ID exists for a domain). If it returns null, serve a static 404.

Worker change (subdomain section, around line 2128):
```javascript
// ─── SUBDOMAIN ───
if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
  const slug = hostname.replace(`.${ROOT_DOMAIN}`, "");
  if (!slug || slug.includes(".") || slug === "www") {
    return cachedFetch(request, "", ctx, false, env);
  }

  // NEW: Fast store-existence check before heavy SPA serving
  const storeId = await _resolveStoreId(hostname, env);
  if (!storeId) {
    // Cache the 404 for 60s to prevent repeated DB lookups
    const notFoundHtml = `<!DOCTYPE html><html><head><title>Store Not Found</title>
      <style>body{font-family:'Inter',sans-serif;display:flex;align-items:center;
      justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#333}
      .c{text-align:center}.c h1{font-size:1.5rem;margin-bottom:8px}
      .c p{color:#666;margin-bottom:16px}
      .c a{color:#4361ee;text-decoration:none}</style></head>
      <body><div class="c"><h1>Store Not Found</h1>
      <p>No store exists at "${escapeHtml(slug)}.storivo.in"</p>
      <a href="https://storivo.in">Create your store →</a></div></body></html>`;
    return new Response(notFoundHtml, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
        ...SECURITY_HEADERS,
      },
    });
  }

  // Existing flow continues for valid stores...
  const [customDomain, seoResponse, botResponse] = await Promise.all([...]);
  // ...
}
```

This makes non-existent subdomains return in **~200ms** instead of ~5s.

### Part 2: Cache Negative Results

The `_resolveStoreId` function already caches negative results in memory for 60s (line 798). But on cold starts, it still hits the DB. Add Cache API caching for negative results too:

```javascript
// In _resolveStoreId, after DB returns null:
if (!storeId) {
  // Cache negative result in Cache API for 60s
  cache.put(storeIdCacheKey, new Response("", {
    headers: { "Cache-Control": "public, max-age=60" },
  })).catch(() => {});
}
```

## Files to Modify

1. `docs/cloudflare-worker-current.js` -- Add store-existence check in subdomain handler + cache negative results

**After updating the worker code, it must be manually redeployed to Cloudflare.**

## Expected Impact

| Scenario | Before | After |
|---|---|---|
| Non-existent subdomain (cold) | ~5s | ~200-400ms |
| Non-existent subdomain (warm cache) | ~5s | ~50ms |
| Existing store (no change) | ~5s | ~5s (unchanged) |

The fix adds only one lightweight DB query (`_resolveStoreId`) to the critical path for subdomains, but this is already cached in Cache API / KV / memory for real stores. For non-existent stores, this single fast check replaces the entire SPA download + hydration cycle.

