

# Storefront Cold-Load Performance Optimization

## Current Bottleneck Analysis

On an incognito (cold) visit to a custom domain like `mgwinner.in`, the waterfall looks like:

```text
[0ms]    DNS → CF Worker receives request
[~50ms]  Worker: resolveDomain() — DB lookup (cached after first hit)
[~50ms]  Worker: getCustomDomainForSlug() — SEQUENTIAL, another DB lookup
[~100ms] Worker: proxyToOrigin() + prefetchStorefrontData() — PARALLEL
         BUT: proxyToOrigin fetches HTML from Lovable origin (~300-800ms TTFB)
         AND: prefetchStorefrontData() fetches RPC (~200-500ms)
[~500ms] Worker: injects __STORE_SLUG__ + __STOREFRONT_DATA__ into HTML
[~600ms] Browser receives HTML, starts parsing
[~600ms] HTML inline <script> starts ANOTHER prefetch (redundant — Worker already injected data)
[~700ms] Browser downloads main JS bundle (~150-300KB gzipped)
[~1200ms] main.tsx boot() waits up to 4s for __STOREFRONT_PREFETCH__ (redundant)
[~1500ms] React mounts, reads __STOREFRONT_DATA__ (already available)
[~2000ms] StorefrontLayout renders, Supabase auth SDK initializes (deferred)
[~2500ms] Images start loading (hero, products)
[~3-8s]  Full interactive depending on network/device
```

**Key problems:**
1. **Redundant data fetch**: Worker already injects `__STOREFRONT_DATA__`, but `index.html` inline script starts another identical RPC call
2. **Sequential Worker DB lookups**: `resolveDomain()` then `getCustomDomainForSlug()` run back-to-back instead of parallel
3. **4-second boot() timeout**: `main.tsx` awaits prefetch promise even when Worker already injected data
4. **Google Fonts blocking**: Even with `media=print` trick, font CSS files add network roundtrips
5. **Large JS payload**: All storefront contexts (Cart, Wishlist, StorefrontAuth) load eagerly on first render
6. **Hero image not preloaded at edge**: Worker preloads first product image but not the hero banner

---

## Optimization Plan (6 changes, targeting 2-3s cold load)

### 1. Eliminate redundant data fetch in index.html

The inline `<script>` in `index.html` starts a `fetch()` to `get_storefront_data` on every load. When the Cloudflare Worker has already injected `__STOREFRONT_DATA__`, this is completely redundant.

**Change**: The script already checks `if(window.__STOREFRONT_DATA__)return;` at the top — but on custom domains the Worker injects data AFTER this script runs (it's injected into `<head>` before this script). The issue is that `boot()` in `main.tsx` still awaits `__STOREFRONT_PREFETCH__` for up to 4 seconds.

**Fix in `main.tsx`**: Skip the prefetch await entirely when `__STOREFRONT_DATA__` is already present. This saves 0-4 seconds.

### 2. Parallelize Worker DB lookups for subdomains

Currently for subdomain routes, the Worker calls `getCustomDomainForSlug(slug)` sequentially to check for 301 redirect to custom domain. This adds ~100-200ms.

**Fix in Worker**: Run `getCustomDomainForSlug()`, `handleSeoFiles()`, and `handleBot()` checks in parallel with the main `cachedFetch()` using `Promise.all` pattern — if custom domain exists, return redirect; otherwise return the cached fetch result.

### 3. Preload hero image at the edge (Worker-level)

The Worker's `fetchAndInjectSlug()` currently preloads the first product image but NOT the hero banner. The hero is the LCP element.

**Fix in Worker**: Extract `mobile_hero_url` / `mobile_hero_images[0]` from `storefrontData` and inject a `<link rel="preload" as="image" fetchpriority="high">` for it. Also inject preload for the logo.

### 4. Self-host Inter font (eliminate Google Fonts roundtrips)

The `index.html` loads Inter from Google Fonts, which requires DNS+TLS to `fonts.googleapis.com` and `fonts.gstatic.com` (2 extra connections). The project already has a memory note about self-hosting Inter.

**Fix**: Remove Google Fonts Inter references from `index.html`. Add a local `@font-face` declaration in `index.css` pointing to `/fonts/inter-latin.woff2` (already exists in the project per memory). Keep decorative fonts (Alegreya SC, Changa, Montserrat) as deferred Google Fonts since they're non-critical.

### 5. Defer non-critical storefront JS (Cart, Wishlist contexts)

On cold load, CartProvider, WishlistProvider, and StorefrontAuthProvider all initialize immediately. For a first-time visitor just viewing the homepage, cart/wishlist are empty and auth is anonymous.

**Fix**: Wrap these providers' initialization logic with `requestIdleCallback` where possible. StorefrontAuthContext already does this — verify Cart and Wishlist do too. If not, defer their localStorage reads.

### 6. Add `modulepreload` hints for critical storefront chunks

The Worker injects data but doesn't hint which JS chunks the browser will need. This means the browser discovers chunk dependencies only after parsing the entry bundle.

**Fix in Worker**: After the build, the theme-1 layout chunk filename is stable. Add `<link rel="modulepreload">` hints for the main entry chunk and the active theme chunk in the Worker's HTML injection.

---

## Technical Implementation Details

### Files to modify:
- `src/main.tsx` — Skip prefetch await when data already injected (change 1)
- `docs/cloudflare-worker-current.js` — Parallelize lookups + hero preload + modulepreload (changes 2, 3, 6)
- `index.html` — Remove Inter Google Fonts, add local font-face (change 4)
- `src/index.css` — Add `@font-face` for self-hosted Inter (change 4)
- `src/contexts/CartContext.tsx` — Audit for eager initialization (change 5)
- `src/contexts/WishlistContext.tsx` — Audit for eager initialization (change 5)

### Expected impact:
| Optimization | Time saved |
|---|---|
| Skip redundant prefetch await | 0-4s (cold) |
| Parallel Worker DB lookups | 100-200ms |
| Hero preload at edge | 200-500ms (LCP) |
| Self-host Inter font | 100-300ms (eliminates 2 connections) |
| Defer cart/wishlist init | 50-100ms (main thread) |
| Modulepreload hints | 100-200ms (chunk discovery) |
| **Total estimated** | **1-5s improvement** |

