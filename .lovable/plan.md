

# Remove Hero Banner

Remove the `StorefrontMobileHero` component from all storefront home pages and the `HeroBannerCarousel` from theme variants V10 and V12.

## Changes

### 1. `src/pages/StorefrontHome.tsx`
- Remove the `StorefrontMobileHero` import (line 14)
- Remove both `StorefrontMobileHero` usages (lines 206, 212) from the conditional block, keeping only the `UniversalCategories` component — simplify the ternary to just render categories directly

### 2. `src/pages/StorefrontHomeV10.tsx`
- Remove `HeroBannerCarousel` import and its hero section rendering

### 3. `src/pages/StorefrontHomeV12.tsx`
- Remove `HeroBannerCarousel` import and its hero section rendering

### 4. `index.html`
- Remove any hero-image `<link rel="preload">` hints injected by the prefetch script (if present)

### 5. `docs/cloudflare-worker-current.js`
- Remove hero image preload injection from the Worker's `injectIntoHtml` function (if present), since there's no hero banner to preload

The hero component files (`StorefrontHero.tsx`, `StorefrontMobileHero.tsx`, `HeroBannerCarousel.tsx`) can be kept or deleted — they'll be dead code after these changes.

