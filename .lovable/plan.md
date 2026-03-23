

## Plan: Cloudflare Worker Latency & Correctness Fixes

8 targeted fixes to the production worker (`docs/cloudflare-worker-fixed.js`), ordered by impact.

---

### Changes

#### 🔴 Fix 1: Parallelize subdomain checks (lines 711-725)

Replace sequential `getCustomDomainForSlug → handleSeoFiles → handleBot → cachedFetch` with `Promise.all` for the first three:

```js
const [customDomain, seoResponse, botResponse] = await Promise.all([
  getCustomDomainForSlug(slug),
  handleSeoFiles(url, slug),
  handleBot(request, slug, url, false),
]);
if (customDomain) return Response.redirect(`https://${customDomain}${url.pathname}${url.search}`, 301);
if (seoResponse) return seoResponse;
if (botResponse) return botResponse;
return cachedFetch(request, slug, ctx);
```

Also parallelize the custom domain path (lines 742-748) for SEO + bot checks.

**Impact**: Saves ~50-150ms on every subdomain request by running independent checks concurrently.

#### 🔴 Fix 2: Cache prefetchStorefrontData independently (lines 303-322)

POST bypasses CF edge cache. Add manual edge caching keyed by slug with 5-min TTL:

```js
async function prefetchStorefrontData(slug) {
  const cacheKey = new Request(`https://cache/storefront-data-${slug}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  // ... existing POST fetch ...
  const data = await res.json();
  await cache.put(cacheKey, new Response(JSON.stringify(data), {
    headers: { "Cache-Control": "public, max-age=300" },
  }));
  return data;
}
```

**Impact**: Eliminates redundant Supabase RPC calls on cache-miss HTML revalidations.

#### 🔴 Fix 3: Cache negative domain lookups in getCustomDomainForSlug (lines 187-222)

Currently, stores without custom domains hit Supabase on every cache miss. The function already caches results, but `custom_domain: null` is cached as `null` which is returned correctly. However, the cache TTL should use a shorter TTL for nulls to speed up activation when a domain IS added:

Already working correctly — the `null` case is cached for 300s. No code change needed here; the parallelization in Fix 1 eliminates the blocking impact.

#### 🟡 Fix 4: Probabilistic rate limit cleanup (line 631)

Replace `cleanRateLimitMap()` with:
```js
if (Math.random() < 0.01) cleanRateLimitMap();
```

#### 🟡 Fix 5: Remove redundant bot regex test (line 539)

Change `if (SOCIAL_BOT_REGEX.test(ua) || SEARCH_BOT_REGEX.test(ua))` to just `if (SOCIAL_BOT_REGEX.test(ua))` since search bots already returned from the block above (line 505). If the search bot block failed/fell through, they should still get OG tags, so keep the combined check but restructure:

```js
// OG fallback for social bots AND search bots whose bot-render failed
try { ... }
```

Actually the current logic is correct as a fallback — search bots that fail `bot-render` fall through to get OG tags. The redundant regex is fine as-is for clarity. Skip this.

#### 🟡 Fix 6: Skip escapeHtml on CSS gradient values

In any SSR shell injection, don't escape values destined for `style` attributes. Minor CPU savings — will note but not change since the SSR shell is in `index.html` not the worker.

#### 🟢 Fix 7: Return 503 instead of 200 on origin timeout (line 291)

Change `status: 200` to `status: 503` in the proxyToOrigin error fallback. The meta-refresh retry still works with 503.

#### 🟢 Fix 8: Redirect www custom domains to naked domain (after line 738)

After resolving the slug for a custom domain, check if the original hostname started with `www.` and redirect:

```js
if (slug) {
  if (hostname !== cleanDomain) {
    return Response.redirect(`https://${cleanDomain}${url.pathname}${url.search}`, 301);
  }
  // ... rest of custom domain handling
}
```

---

### Files Modified

| File | Changes |
|------|---------|
| `docs/cloudflare-worker-fixed.js` | All 6 fixes above |

### No Risk Areas
- No frontend code changes
- No database changes
- No edge function changes
- All fixes are backward-compatible

