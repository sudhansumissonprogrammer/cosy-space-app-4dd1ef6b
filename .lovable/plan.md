

## Plan: Cold-Load Performance Optimization (4-5s → <2s on Mobile)

The architecture is already well-optimized for repeat visits (Cloudflare Worker injects `__STOREFRONT_DATA__`, localStorage SWR cache). The cold-load bottleneck is clear: **JS parse/execute blocks rendering for ~1.5s**, the LCP image isn't discoverable until React renders, and non-critical resources compete with critical ones.

---

### Root Cause Analysis

| Bottleneck | Impact | Fix |
|-----------|--------|-----|
| CSS bundle render-blocks for 1,250ms | FCP delayed | Inline critical CSS in `index.html` |
| LCP image only discovered after React renders | LCP 4.6s | Worker injects `<link rel="preload">` for first product image |
| `registerSW.js` is render-blocking (160ms) | FCP delayed | Defer SW registration |
| All storefront JS loads before paint | FCP 3.2s | HTML skeleton in `index.html` for instant paint |
| No `<meta charset>` early enough | Best practices flag | Move charset to first position |
| Unused CSS 17KB in main bundle | Slower parse | Already using cssCodeSplit; add purgecss considerations |

---

### Changes

#### 1. Enhanced HTML Shell with Storefront Skeleton (index.html)

Replace the spinner with a **full storefront skeleton** (marquee + nav + search + product grid) directly in `index.html`. This renders in <100ms before any JS loads.

Also:
- Move `<meta charset>` to be the very first child of `<head>` (Best Practices fix)
- Add `modulepreload` hints for the main entry chunk
- Expand inline critical CSS to include storefront layout (nav bar, marquee bar, card grid skeleton shapes)

**Key change**: The `<div id="root">` will contain a full storefront skeleton HTML instead of a spinner, so users see a meaningful layout immediately.

#### 2. Worker: Inject LCP Image Preload (docs/cloudflare-worker-fixed.js)

In `fetchAndInjectSlug()`, after fetching storefront data, extract the first product image URL and inject a `<link rel="preload" as="image" fetchpriority="high">` into the HTML `<head>`. This makes the LCP image discoverable at HTML parse time, not after JS execution.

Also inject `<link rel="preconnect">` for the product image origin (e.g., `overlaysnow.com`).

```text
Current flow:  HTML → parse JS → execute React → render <img> → browser discovers image → loads
New flow:      HTML (with preload) → browser discovers image immediately → loads in parallel with JS
```

#### 3. Defer Service Worker Registration (vite.config.ts)

The `registerSW.js` script blocks rendering for 160ms. Change VitePWA to use `injectRegister: null` and register the SW manually after the page is interactive (in `main.tsx` with `requestIdleCallback`).

#### 4. Async CSS Loading Pattern (index.html)

Add the async CSS loading pattern for the main stylesheet. The Vite-generated CSS link in the built HTML is render-blocking. We'll add a small inline script that converts the CSS `<link>` to async after DOM is ready.

#### 5. Optimize Font Loading (index.html)

The current font preload/async pattern is good but can be improved:
- Remove the `<link rel="preload" as="style">` for Inter (it creates an extra request that doesn't help since the stylesheet is already loaded async)
- Keep only the `media="print" onload="this.media='all'"` pattern

#### 6. Add `fetchpriority` to First Product Cards (ProductCardStyle1.tsx + all card styles)

Already implemented with `priority` prop. Verify it flows through all 4 card styles correctly — this is already done.

#### 7. Storefront Layout: Preconnect to Image Origins (StorefrontLayout.tsx)

Add a `useEffect` that extracts the image CDN origin from the first product and injects a `<link rel="preconnect">` dynamically. This is already partially planned but needs implementation.

---

### File Changes Summary

| File | Change |
|------|--------|
| `index.html` | Move charset first; replace spinner with storefront skeleton; expand critical CSS; remove redundant font preload; add async CSS script |
| `docs/cloudflare-worker-fixed.js` | In `fetchAndInjectSlug()`: extract first product image, inject `<link rel="preload as="image">` and `<link rel="preconnect">` for image origin |
| `vite.config.ts` | Set `injectRegister: null` in VitePWA config to stop render-blocking `registerSW.js` |
| `src/main.tsx` | Add manual SW registration via `requestIdleCallback` after app mounts |
| `src/layouts/StorefrontLayout.tsx` | Add `useEffect` to inject `<link rel="preconnect">` for product image CDN origin |

### Expected Impact

| Metric | Before | After (estimated) |
|--------|--------|-------------------|
| FCP | 3.2s | ~1.2s |
| LCP | 4.6s | ~2.0s |
| Speed Index | 5.1s | ~2.5s |
| TBT | 0ms | 0ms (maintained) |
| CLS | 0 | 0 (maintained) |
| Performance Score | 74 | 90-95+ |

