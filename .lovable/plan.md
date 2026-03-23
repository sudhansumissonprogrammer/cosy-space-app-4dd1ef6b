

## Performance Fix Plan: Image Delivery + LCP Optimization

### Problem Summary
Lighthouse reports **1,684 KiB** wasted on images. The root causes:

1. **Hover/secondary images** in ProductCardStyle1/2/3 lack `srcSet` — browsers load full-size originals even though `optimizeImageUrl` is called, the single `src` doesn't provide responsive sizing hints
2. **Carousel dot animations** use `width` and `background-color` (non-composited CSS properties) causing layout thrash
3. **Duplicate preconnect** for Supabase origin and missing `crossorigin` attribute on overlaysnow.com preconnect

### Changes

#### 1. Add `srcSet` to hover images in all product cards (~1,500 KiB savings)

**Files**: `ProductCardStyle1.tsx`, `ProductCardStyle2.tsx`, `ProductCardStyle3.tsx`

Add `srcSet` and `sizes` to the secondary (hover) `<img>` tag in each file. Currently these only have `src={optimizeImageUrl(images[1], 400)}`. Add:
```tsx
srcSet={getImageSrcSet(images[1], [300, 400, 600])}
sizes={PRODUCT_CARD_SIZES}
```

Also add `decoding="async"` to each hover image for consistency.

#### 2. Fix carousel dot non-composited animations

**File**: `BestSellingCarousel.tsx`

Replace `transition-all` on dot buttons with `transition-colors` and use `scale` transform instead of animating `width`:
- Active dot: use fixed width with `scale-x-[2.5]` transform instead of toggling between `w-2` and `w-5`
- Or simpler: just remove width animation entirely, keep only opacity/background-color changes using `transition-opacity`

#### 3. Fix preconnect issues

**File**: `index.html`

- Remove duplicate Supabase preconnect (currently appears twice)
- Remove `crossorigin` from overlaysnow.com preconnect (same-origin cookies not needed, and the mismatch causes it to be "unused")
- Keep only 4 preconnects max (Supabase, fonts.googleapis.com, fonts.gstatic.com, overlaysnow.com)

#### 4. Fix robots.txt SEO error

**File**: `public/robots.txt`

Add proper `Sitemap:` directive or ensure the file validates. The edge function version is correct but the static fallback in `public/robots.txt` lacks it.

### Expected Impact
- **Image delivery**: ~1,500-1,684 KiB savings from responsive hover images
- **CLS**: Reduced from non-composited animation fix
- **LCP**: Minor improvement from fixing preconnect
- **SEO**: Fix robots.txt validation error (92→100)

