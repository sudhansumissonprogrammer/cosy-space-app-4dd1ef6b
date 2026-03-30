# Theme 16 Performance Optimization Plan

## Problem

Theme 16 takes ~10 seconds to fully load. Since Theme 16 re-exports Theme 1 (Classic) home and wraps it in StorefrontShell, the bottlenecks are shared with V1 but compounded by the lazy-loading chain.

## Root Causes Identified

1. **Lazy-load waterfall**: App.tsx lazy-loads StorefrontLayoutV16, which imports StorefrontShell, which loads store data, then renders Outlet, which lazy-loads StorefrontHomeV16 (re-exports StorefrontHome). That's 2 sequential lazy chunks before any content renders.
2. **Initial product fetch is only 20 items** (`PAGE_SIZE = 20` in useStorefrontProducts), but the home page splits best-selling vs non-best-selling, so if many are best-selling the "Popular Products" section may appear empty until the infinite scroll query fires — causing a second network round-trip.
3. **VariantCountProvider** fires a batch query for all visible product IDs on every render, adding a DB round-trip before cards can fully render.
4. **StorefrontShell overlays** (SideCart, FloatingWhatsApp, ExitIntentPopup) are lazy but still imported and mounted on initial load, adding to hydration cost.
5. **Image quality at 60** for product cards — each card loads 300px + 600px srcSet images. With 500+ products this is fine for pagination but the initial 4-8 cards could load faster with smaller payloads.
6. **Google Fonts** loaded via idle callback but still blocks text rendering if fonts aren't cached.

## Plan

### Step 1: Eliminate the double lazy-load waterfall

- Change `StorefrontHomeV16.tsx` from a re-export to a direct component that imports `StorefrontHome` statically (not lazy). Since the layout already lazy-loads, the home page content shouldn't also be lazy.
- In `App.tsx`, for theme-16 routes, use `StorefrontHome` directly as the child element instead of lazy `StorefrontHomeV16`, since V16 home is identical to V1.

### Step 2: Preload the layout chunk

- Add a `<link rel="modulepreload">` hint in `index.html` for the StorefrontLayoutV16 chunk, or use Vite's dynamic import with `/* @vite-ignore */` preload comment.
- Alternatively, in the theme detection logic in App.tsx, trigger `import("./layouts/StorefrontLayoutV16")` eagerly when theme-16 is detected (before React needs it).

### Step 3: Reduce image payload for above-fold cards

- Lower quality from 60 to 45 for the first 4 priority product card images (srcSet sizes [200, 400] instead of [300, 600]).
- This cuts ~40% off image bytes for above-fold content.

### Step 4: Defer VariantCountProvider

- Wrap `VariantCountProvider` to delay the batch query by 1 second or until after first paint, so product cards render immediately with a fallback "no variants" state, then update reactively.

### Step 5: Defer non-critical overlays further

- Move `ExitIntentPopup` to load only after 5 seconds of user activity (not on mount).
- Keep `SideCart` and `FloatingWhatsApp` as-is (already lazy with Suspense).

### Step 6: Optimize StorefrontShell theme CSS computation

- Memoize `buildThemeStyle` result more aggressively — currently recalculates on every render even when inputs haven't changed.
- Move the `document.body.style` sync to use a single `cssText` assignment instead of per-property `setProperty` calls.

## Technical Details

### Files to modify:

- `src/pages/StorefrontHomeV16.tsx` — static import instead of re-export
- `src/App.tsx` — preload theme-16 layout chunk on theme detection
- `src/components/storefront/ProductCardStyle1.tsx` — reduce above-fold image sizes
- `src/hooks/useVariantCounts.tsx` — add deferred loading (1s delay)
- `src/layouts/StorefrontShell.tsx` — defer ExitIntentPopup, optimize CSS sync
- `src/pages/StorefrontHome.tsx` — minor: reduce ABOVE_FOLD_COUNT image quality

### Expected Impact:

- Eliminating double lazy waterfall: **-1.5s**
- Image payload reduction: **-0.5s**
- Deferred variant query: **-0.5s**  
- Chunk preloading: **-1s**
- Combined: **~5.5s reduction** (10s → ~5s target) i want them should load on store font in 5 second