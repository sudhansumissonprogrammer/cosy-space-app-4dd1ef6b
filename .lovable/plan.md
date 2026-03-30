

# Universal Cold-Load Optimization — All Themes to 4-5s

## Problem
Theme 16 was optimized to ~5s, but themes 1-3, 10-15 still take 7-10s on cold loads. The same bottlenecks exist across all themes but haven't been addressed universally.

## What Changes (No Design Changes)

### 1. Priority Image Optimization for ProductCardStyle2, Style3, Style4
**Currently**: Styles 2, 3, and 4 always load images at quality 60 with srcSet [300, 400, 600] — even for above-fold cards.
**Fix**: Apply the same priority optimization already in Style1: when `priority=true`, use quality 45 and srcSet [200, 400]. This cuts ~40% off above-fold image bytes for all themes using these card styles (themes 2, 3, 10, 11, 12, 13, 14, 15).

Files: `ProductCardStyle2.tsx`, `ProductCardStyle3.tsx`, `ProductCardStyle4.tsx`

### 2. Eliminate Double Lazy Waterfall for Re-Export Home Pages
**Currently**: `StorefrontHomeV11` re-exports from V3, `StorefrontHomeV12` re-exports from V10, `StorefrontHomeV15` re-exports from V14. These are lazy-loaded in App.tsx, creating a double chunk download (the re-export file + the actual component).
**Fix**: In `storefrontChildRoutes()`, map these themes directly to their parent home component — same pattern already applied for Theme 16.

File: `App.tsx` (lines ~164-166)

### 3. Eager Home Chunk Prefetch for All Themes
**Currently**: `prefetchHomeChunk()` already covers all themes — no change needed here. Already optimized.

### 4. Static Imports for Thin Re-Export Home Pages
**Fix**: Convert `StorefrontHomeV11.tsx`, `StorefrontHomeV12.tsx`, `StorefrontHomeV15.tsx` to use static imports (like V16 was already fixed), so if they're ever loaded directly, they don't create a waterfall.

Files: `StorefrontHomeV11.tsx`, `StorefrontHomeV12.tsx`, `StorefrontHomeV15.tsx`

### 5. Defer StorefrontInstagramSection Import in V2, V3, V10, V13
**Currently**: Some home pages statically import `StorefrontInstagramSection` and `StorefrontTrustStrip` even though they render below the fold.
**Fix**: Make these lazy imports where they aren't already (V2, V3 already lazy-load search overlay but not Instagram). This reduces initial chunk size.

Files: `StorefrontHomeV2.tsx`, `StorefrontHomeV3.tsx`, `StorefrontHomeV10.tsx`, `StorefrontHomeV13.tsx`

### 6. PAGE_SIZE Alignment
**Currently**: `PAGE_SIZE = 20` but edge worker inlines 14 products. The mismatch means React discards the 14 inline products and re-fetches 20.
**Fix**: Change `PAGE_SIZE` to 14 to match the edge worker's inline count, eliminating a redundant API call on cold load.

File: `useStorefrontProducts.ts`

## Technical Details

### ProductCardStyle2/3 image fix (example):
```typescript
// Before:
src={optimizeImageUrl(images[0], 400)}
srcSet={getImageSrcSet(images[0], [300, 400, 600])}

// After:
src={optimizeImageUrl(images[0], priority ? 200 : 400, priority ? 45 : undefined)}
srcSet={getImageSrcSet(images[0], priority ? [200, 400] : [300, 400, 600], priority ? 45 : undefined)}
```

### App.tsx storefrontChildRoutes fix:
```typescript
// Map re-export themes to their parent home component
const HomeComponent =
  theme === "theme-16" ? StorefrontHome :      // already done
  theme === "theme-15" ? StorefrontHomeV14 :    // V15 re-exports V14
  theme === "theme-11" ? StorefrontHomeV3 :     // V11 re-exports V3
  theme === "theme-12" ? StorefrontHomeV10 :    // V12 re-exports V10  
  // ... rest unchanged
```

Wait — V15 and V12 pass different props (defaultCardStyle, etc.), so they can't simply be replaced by their parent. Only V11 (exact re-export) can be mapped directly. V12 and V15 need static imports instead.

### Corrected approach for V12/V15:
Keep them as separate lazy components but ensure their re-export files use static imports to avoid chain loading.

### PAGE_SIZE change:
```typescript
// useStorefrontProducts.ts line 4
const PAGE_SIZE = 14; // Match edge worker inline count
```

## Expected Impact per Theme

| Optimization | Savings | Themes Affected |
|---|---|---|
| Priority image quality reduction | ~0.5s | 2, 3, 10, 11, 12, 13, 14, 15 |
| Eliminate V11 double lazy | ~0.8s | 11 |
| Static imports for V12, V15 | ~0.5s | 12, 15 |
| Lazy Instagram/TrustStrip | ~0.3s | 2, 3, 10, 13 |
| PAGE_SIZE 20→14 alignment | ~1-2s | ALL themes |

**Combined: ~2-3s reduction across all themes**, bringing 7-10s cold loads down to ~4-6s.

## Files to Modify
1. `src/components/storefront/ProductCardStyle2.tsx` — priority image optimization
2. `src/components/storefront/ProductCardStyle3.tsx` — priority image optimization
3. `src/components/storefront/ProductCardStyle4.tsx` — priority image optimization
4. `src/App.tsx` — map V11 directly to V3 home in storefrontChildRoutes
5. `src/pages/StorefrontHomeV11.tsx` — static import instead of re-export
6. `src/pages/StorefrontHomeV12.tsx` — static import instead of re-export
7. `src/pages/StorefrontHomeV15.tsx` — static import instead of re-export
8. `src/pages/StorefrontHomeV2.tsx` — lazy import StorefrontInstagramSection
9. `src/pages/StorefrontHomeV3.tsx` — lazy import StorefrontInstagramSection
10. `src/pages/StorefrontHomeV10.tsx` — lazy import StorefrontInstagramSection (already lazy — verify)
11. `src/pages/StorefrontHomeV13.tsx` — lazy import StorefrontInstagramSection
12. `src/hooks/useStorefrontProducts.ts` — PAGE_SIZE 20 → 14

