

## Optimize Storefront Execution: Reduce Blocking and Defer Non-Critical Work

### Analysis of Current Bottlenecks

After inspecting the code, here is what actually blocks first paint and interactivity:

**HIGH IMPACT (real blockers):**

1. **`main.tsx` boot sequence** — Awaits `__STOREFRONT_PREFETCH__` up to 3 seconds before mounting React. On non-Worker paths without injected data, users stare at the HTML skeleton for up to 3s before React even starts.

2. **Storefront-core chunk is 120KB (36KB gz)** — Contains ~15 heavy UI components (UniversalProductCard, BestSellingCarousel, HeroBannerCarousel, SearchOverlay, etc.) that are NOT needed for first paint. Only the Shell + data hook + providers are critical.

3. **Facebook Pixel injection** — `useFacebookPixel` synchronously injects a 3rd-party script into `<head>` during render. This competes with main thread during initial paint.

**LOW IMPACT (already optimized):**
- `StorefrontAuthProvider` — already defers via `requestIdleCallback`
- `trackPageView` — already uses `setTimeout(3000)`
- `useStorefront` — already non-blocking (shows skeleton during fetch)
- CartProvider/WishlistProvider — lightweight (localStorage read), cannot be lazy-loaded since child components depend on context immediately

### Plan

**Step 1: Remove boot blocking in `main.tsx`**

Current code awaits prefetch up to 3s before `createRoot`. Change to mount React immediately and let `useStorefront` consume `__STOREFRONT_DATA__` if available.

```text
BEFORE: await prefetch (up to 3s) → createRoot → render
AFTER:  createRoot → render immediately → useStorefront reads injected data if present
```

The `useStorefront` hook already checks `window.__STOREFRONT_DATA__` and uses it as `initialData`. The boot await is redundant — it was added to avoid a "double skeleton" flash, but the Shell already handles loading state gracefully.

Changes to `src/main.tsx`:
- Remove async `boot()` function
- Call `createRoot().render(<App />)` synchronously
- Keep SW cleanup logic unchanged

**Step 2: Split storefront-core into critical + deferred chunks**

Split the Vite `manualChunks` config into two chunks:

`storefront-core` (critical, ~40KB → ~12KB gz):
- StorefrontShell
- StorefrontLayout.logic
- themeUtils
- CartContext, WishlistContext, StorefrontAuthContext
- StorefrontNotFound
- subdomain utils
- useStorefrontThemeConfig, useThemePreview

`storefront-ui` (deferred, loaded by themes when needed, ~80KB → ~24KB gz):
- UniversalProductCard
- UniversalCategories
- BestSellingCarousel
- StorefrontSearchOverlay, StorefrontSearchBar
- StorefrontMobileHero, StorefrontHero, HeroBannerCarousel
- StorefrontFooter, StorefrontMarquee
- StorefrontAbout, StorefrontCategories, StorefrontInstagramSection
- ProductCardStyle*, OptimizedImage, StarRating
- SideCart, FloatingWhatsApp, ExitIntentPopup
- DynamicPwaManifest, SmartInstallPrompt, PwaInstallBanner
- ShareStoreDialog, ContentSkeleton, LazyRender
- useFacebookPixel, useMetaTags, useJsonLd
- useProductCardActions, trackPageView, productUtils, prefetchStorefrontRoutes

This works because Shell already lazy-imports SideCart, FloatingWhatsApp, etc. The UI components are only imported by theme home pages and child pages — not by the Shell itself.

**Step 3: Defer Facebook Pixel to idle time**

Wrap the `useFacebookPixel` script injection in `requestIdleCallback` so it doesn't compete with first paint:

```tsx
// In useFacebookPixel.ts
useEffect(() => {
  if (!pixelId) return;
  const schedule = typeof requestIdleCallback !== 'undefined' 
    ? requestIdleCallback 
    : (cb: () => void) => setTimeout(cb, 2000);
  const handle = schedule(() => {
    // existing pixel injection code
  });
  return () => { /* cleanup */ };
}, [pixelId]);
```

**Step 4: Defer Google Fonts loading**

In `StorefrontShell`, wrap the `loadGoogleFonts` call in `requestIdleCallback`:

```tsx
useEffect(() => {
  if (!themeConfig) return;
  const schedule = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 1000);
  schedule(() => loadGoogleFonts(themeConfig));
}, [themeConfig?.heading_font, themeConfig?.body_font]);
```

### Expected Impact

| Metric | Before | After |
|---|---|---|
| Boot blocking | Up to 3s (prefetch await) | 0ms (sync mount) |
| Critical JS (gz) | ~36KB (all of storefront-core) | ~12KB (core only) |
| First Paint | ~2-3s | ~0.8-1.2s |
| Time to Interactive | ~4-6s | ~2-3s |
| Facebook Pixel | Blocks main thread at render | Deferred to idle |
| Google Fonts | Blocks at render | Deferred to idle |

### Files Changed

1. `src/main.tsx` — Remove async boot, mount synchronously
2. `vite.config.ts` — Split `storefront-core` into `storefront-core` + `storefront-ui`
3. `src/hooks/useFacebookPixel.ts` — Defer script injection to idle
4. `src/layouts/StorefrontShell.tsx` — Defer Google Fonts to idle

### Safety

- No functional changes — same data flow, same components render
- `useStorefront` already handles missing `__STOREFRONT_DATA__` gracefully (fetches via RPC)
- Providers remain eagerly loaded (required by child components)
- Overlay components already lazy-loaded in Shell

