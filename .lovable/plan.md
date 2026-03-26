

# Frontend Performance Fix Plan: Lighthouse 47 → 90+

## Root Cause Analysis

**Why LCP is ~5.9s:**
1. Hero images have no intrinsic dimensions — browser can't allocate space until image loads
2. `StorefrontMobileHero` wrapper has no `aspect-ratio` or `min-height`, so the hero banner pops in
3. Products wait for `useStorefrontProducts` API call to resolve before rendering anything
4. The `index.html` prefetch script fetches store data but products are loaded separately after React hydration

**Why CLS is ~0.7:**
1. Hero banner has no reserved space (`aspect-ratio` missing on wrapper)
2. Product grid skeletons and real cards may have slightly different heights
3. Category bar, marquee, and search bar all load dynamically and push content down
4. `StorefrontMobileHero` renders `null` initially until images resolve, then pops in

**Why CSS blocks render (~780ms):**
1. Tailwind CSS is one large file — no critical CSS extraction
2. Google Fonts loaded via JS in `StorefrontShell` but `index.css` declares `--font-storefront: 'Alegreya SC'` which may trigger FOIT

## Implementation Plan

### 1. Fix CLS — Reserve Space for Hero Banner
**File: `src/components/storefront/StorefrontMobileHero.tsx`**
- Add `aspect-ratio: 16/7` to the wrapper div so space is reserved even before image loads
- Add `min-height` fallback for browsers without `aspect-ratio` support

**File: `src/components/storefront/HeroBannerCarousel.tsx`**
- Ensure the wrapper div always has `aspect-ratio: 16/7` set, not just on images
- The `imageClassName` from StorefrontMobileHero uses `h-auto` which causes CLS — change to constrained height within the aspect-ratio container

### 2. Fix CLS — Product Card Skeleton Matching
**File: `src/pages/StorefrontHome.tsx`**
- Ensure `ProductCardSkeleton` has identical height structure to `ProductCardStyle1`
- Both must use the same `aspect-ratio: 4/5` for image area and identical padding/spacing

### 3. Fix LCP — Inject First Products in HTML via Worker
**File: `docs/cloudflare-worker-current.js`**
- In the Worker's HTML injection, add top 2 product image URLs as `<link rel="preload" as="image">` tags
- The `get_storefront_shell` RPC already returns categories — extend to also return first 2 product `image_url` values (or add a separate field `hero_product_images`)
- This ensures the LCP image starts downloading before React even loads

**File: `index.html`**
- In the existing prefetch script, after resolving `__STOREFRONT_DATA__`, preload the first product image if no hero image exists (some stores don't have hero banners)

### 4. Fix LCP — Preload Product API Call
**File: `src/hooks/useStorefrontProducts.ts`**
- Add an early fetch trigger: start the `/api/products` fetch in `index.html` prefetch script (alongside store data) and store the promise as `window.__PRODUCTS_PREFETCH__`
- In `useStorefrontProducts`, check for this promise first before making a new fetch

**File: `index.html`**
- After the storefront data prefetch resolves, immediately fire a products fetch to `supabase.co/rest/v1/products?...` (for preview) and store as `window.__PRODUCTS_PREFETCH__`

### 5. Fix Image Loading — Optimize Supabase Image URLs
**File: `src/components/storefront/ProductCardStyle1.tsx`** (and Style2/3/4)
- Already using `optimizeImageUrl` — verified working
- Ensure `width` and `height` attributes are always set on product images (already done: `width={400} height={500}`)
- Add `content-visibility: auto` to below-fold product cards for rendering optimization

### 6. Fix CSS Blocking — Inline Critical CSS
**File: `index.html`**
- Already has inline critical CSS in `<style>` tag — extend it to include storefront card skeleton styles and hero aspect-ratio
- Add `aspect-ratio: 16/7` to the inline skeleton hero class `.sf-skel-hero`

### 7. Fix JS Execution — Reduce Main Thread Blocking
**File: `src/App.tsx`**
- The `LoadingSpinner` component creates 4 skeleton cards with `animate-pulse` — reduce to 2 on mobile (already 4 for desktop grid)
- Defer `prefetchStorefrontRoutes()` call from `useEffect` to `requestIdleCallback`

**File: `src/layouts/StorefrontShell.tsx`**
- Already defers Google Fonts to `requestIdleCallback` — verified good
- Move `trackPageView` to `requestIdleCallback` to avoid main thread contention during load

### 8. Fix Pagination — Direct DB Call in StorefrontHome
**File: `src/pages/StorefrontHome.tsx`**
- Lines 91-134: The `useInfiniteQuery` for pagination calls Supabase directly — this is the pagination for "load more" which only fires on scroll, so it's not a performance issue for initial load
- Leave as-is (only affects subsequent page loads, not LCP/CLS)

## Specific Code Changes

### Changes Summary:
| File | Change | Impact |
|------|--------|--------|
| `StorefrontMobileHero.tsx` | Add `aspect-ratio: 16/7` wrapper + `min-height` | CLS fix |
| `HeroBannerCarousel.tsx` | Set aspect-ratio on container div, not just image | CLS fix |
| `StorefrontHome.tsx` | Skeleton height parity with real cards | CLS fix |
| `index.html` | Preload first product image, extend inline CSS | LCP fix |
| `useStorefrontProducts.ts` | Bridge `__PRODUCTS_PREFETCH__` promise | LCP fix |
| `StorefrontShell.tsx` | Defer `trackPageView` to idle | JS blocking fix |
| `App.tsx` | Defer `prefetchStorefrontRoutes` to idle | JS blocking fix |
| `ProductCardStyle1.tsx` | Add `content-visibility: auto` to non-priority cards | Rendering perf |

### Expected Results:
| Metric | Before | After |
|--------|--------|-------|
| LCP | ~5.9s | <2.5s |
| CLS | ~0.7 | <0.1 |
| Performance | ~47 | 85-92 |

