

# Image Quality Preservation Plan

## Problem

The current pipeline has three issues causing quality loss:

1. **Every image gets compressed** regardless of size -- even images already under 100KB are re-encoded through canvas (lossy), degrading quality for no benefit
2. **Double compression** -- images uploaded through the pipeline get compressed at upload time, then again at display time via the Supabase `render/image` transform API (which re-encodes the already-compressed WebP)
3. **Aggressive quality targets** -- the 200w variant targets 30KB, 400w targets 60KB, and quality iteratively drops as low as 0.15, causing visible artifacts

## Changes

### 1. Skip compression for small images (`imageCompression.ts`)

- In `processImage()`: skip compression for ANY image under 100KB (not just WebP). Return the original file untouched
- In `processImageMultiSize()`: for each variant, if the rendered canvas output at high quality (0.92) is already under 120KB, use it directly without iterative quality reduction
- Raise minimum quality floor from 0.15 to 0.75 so quality never drops to visible-artifact levels

### 2. Use higher quality settings (`imageCompression.ts`)

- Change default quality from 0.8 to 0.92 (near-lossless WebP)
- Set variant KB targets: 200w = 60KB, 400w = 90KB, 800w = 120KB (up from 30/60/120)
- Remove the aggressive dimension-reduction fallback (the 0.7x scale-down loop) -- if quality 0.75 at full size can't hit the target, accept the slightly larger file

### 3. Prevent double compression (`imageOptimize.ts`)

- For Supabase Storage URLs that match our pipeline naming convention (`-200w.webp`, `-400w.webp`, `-800w.webp`), serve the file directly via `/storage/v1/object/` (NOT `/storage/v1/render/image/`)
- Only apply the render/image transform to non-pipeline Supabase images
- This eliminates the re-encoding step that degrades already-optimized images

### 4. Higher display quality (`imageOptimize.ts` + `OptimizedImage.tsx`)

- Raise default display quality from 75 to 85 in `optimizeImageUrl()` and `getImageSrcSet()`
- Update `OptimizedImage.tsx` default quality prop from 75 to 85

### Files Modified

| File | What changes |
|------|-------------|
| `src/lib/imageCompression.ts` | Skip under-100KB files, raise quality floor to 0.75, raise variant KB targets, remove aggressive dimension reduction |
| `src/lib/imageOptimize.ts` | Skip render/image transform for pipeline URLs, raise default quality to 85 |
| `src/components/storefront/OptimizedImage.tsx` | Default quality 75 → 85 |

