

## Plan: Edge-Level Performance Optimizations for Sub-2s LCP

Most of the requested optimizations are already implemented. This plan adds the remaining gaps: HTML streaming, Cloudflare Image CDN routing, enhanced priority hints, and connection warmup at the edge.

---

### What's Already Done (No Changes Needed)

| Request | Status |
|---------|--------|
| LCP image preload with `fetchpriority="high"` + srcset | Done in Worker |
| Preconnect to image CDN + API origin at edge | Done in Worker |
| Cache fully injected HTML (SSR output) | Done in `cachedFetch` |
| Stale-while-revalidate pattern | Done via `ctx.waitUntil` background refresh |
| DNS-prefetch in index.html | Done |
| Skeleton UI for instant visual feedback | Done — real SSR content injected at edge |
| Self-hosted fonts | Done |
| Lazy loading non-critical components | Done |

---

### Remaining Changes

#### 1. HTML Streaming via TransformStream (Worker)

**File:** `docs/cloudflare-worker-fixed.js`

Replace the current "read full HTML → string replace → respond" flow with a **streaming approach** using `TransformStream`. The `<head>` and above-the-fold SSR content are flushed immediately, while the rest of the HTML streams progressively. This reduces TTFB by ~200ms since we don't wait for origin HTML to fully download before starting the response.

Implementation:
- Create a `streamInjectedResponse()` function that uses `TransformStream`
- On first chunk (containing `<head>`): inject `__STORE_SLUG__`, `__STOREFRONT_DATA__`, LCP preload, and preconnect links
- On chunk containing `sf-skeleton`: replace with server-rendered HTML
- Pass through all other chunks immediately
- Used for cache misses; cached responses still serve from Cache API directly

#### 2. Cloudflare Image CDN Pipeline (`/cdn-cgi/image/`)

**File:** `src/lib/imageOptimize.ts`

Add a new optimization path for images served through the Cloudflare zone (storivo.in). Route product images through `/cdn-cgi/image/width=W,quality=70,format=auto/ORIGINAL_URL` which enables:
- Automatic AVIF/WebP negotiation
- Server-side resizing (no oversized images to small screens)
- Edge-cached transformed images

Add this as priority #2 in `optimizeImageUrl()`, after pipeline variants but before Supabase/Shopify checks. Only activate for images served from the storivo.in domain or known storage origins.

**File:** `docs/cloudflare-worker-fixed.js`

Update the server-rendered product card image URLs in `buildServerRenderedShell()` to route through `/cdn-cgi/image/` for Cloudflare-proxied origins. This ensures the SSR HTML serves optimally-sized images from the first byte.

#### 3. Enhanced Priority Hints at Edge (Worker)

**File:** `docs/cloudflare-worker-fixed.js`

Add additional `<link>` tags in the `<head>` injection:
- `<link rel="preload" as="style" href="/assets/index-*.css" fetchpriority="high">` — preload the critical CSS bundle
- `<link rel="preload" as="font" href="/fonts/inter-latin.woff2" type="font/woff2" crossorigin fetchpriority="high">` — ensure the self-hosted font starts loading immediately
- `<link rel="dns-prefetch" href="https://fonts.googleapis.com">` — for optional theme fonts

#### 4. Tiered Cache Headers (Worker)

**File:** `docs/cloudflare-worker-fixed.js`

Update `proxyToOrigin()` HTML cache headers to use proper tiered caching directives:
- Add `CDN-Cache-Control: public, max-age=600` (tells Cloudflare edge to cache longer than browser)
- Add `Vary: Accept-Encoding` to ensure proper GZIP/Brotli cache variants
- For SSR HTML from `fetchAndInjectSlug`: set `Cache-Control: public, max-age=300, stale-while-revalidate=86400` and `CDN-Cache-Control: public, max-age=600, stale-while-revalidate=86400`

#### 5. Connection Warmup at Edge (Worker)

**File:** `docs/cloudflare-worker-fixed.js`

Expand the `<head>` injection to include comprehensive connection warmup:
- `<link rel="preconnect" href="https://kzvfjknnslgcwumzlwkb.supabase.co">` (already done)
- `<link rel="dns-prefetch" href="https://fonts.gstatic.com">` (for theme fonts)
- Dynamic `<link rel="preconnect">` for the store's image CDN origin (already done)
- `<link rel="preconnect" href="https://storivo.in">` for Cloudflare Image CDN if different from current domain

---

### Files to Update

| File | Changes |
|------|---------|
| `docs/cloudflare-worker-fixed.js` | Add HTML streaming, CDN image URLs in SSR, font/CSS preload hints, tiered cache headers |
| `src/lib/imageOptimize.ts` | Add Cloudflare `/cdn-cgi/image/` path for storivo.in-origin images |

### Expected Impact

| Metric | Current | After |
|--------|---------|-------|
| TTFB | ~600ms | ~350ms (streaming) |
| LCP | ~2.0s | ~1.6s (CDN-resized images + font preload) |
| Image payload | Variable | -30% avg (AVIF auto-negotiation) |

