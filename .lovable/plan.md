

# Performance Optimization: Lighthouse 96 → 90+ Target

## Analysis of Lighthouse Report (mgwinner.in)

The three biggest bottlenecks causing FCP 3.7s / LCP 4.4s:

```text
Problem                          Impact
───────────────────────────────  ──────────────────
admin-*.js loaded on storefront  320KB (213KB unused JS) — blocks main thread 253ms
LCP render delay = 1,880ms       React must parse/execute JS before rendering image
LCP image oversized (800w)       Serves 640x800 for 322x403 display (54KB waste)
robots.txt invalid               SEO score penalty
```

## Plan (4 changes)

### 1. Stop admin chunk from loading on storefront

The `manualChunks` config puts `DashboardLayout` + `AdminLayout` + `pages/admin/*` into the "admin" chunk, but many **dashboard pages** (Dashboard, ProductsList, StoreOrders, etc.) are NOT in that chunk. Rollup may create dependency edges from shared code that pull the admin chunk in transitively.

**Fix in `vite.config.ts`**: Expand the admin chunk pattern to include ALL dashboard pages (`/pages/Dashboard`, `/pages/ProductsList`, `/pages/Store*`, etc.) and dashboard-only components (`/components/ProductForm`, `/components/AdminSidebar`, `/components/AppSidebar`, `/components/BulkEditDialog`, `/components/OrderInvoice`). This makes the admin chunk self-contained and eliminates accidental dependency pulls from shared code.

Also add `/contexts/AuthContext` and `/components/ProtectedRoute`, `/components/AdminRoute` to the admin chunk since they're only used on dashboard/admin routes, never on storefront.

### 2. Fix LCP image oversized (product card srcSet)

The `getImageSrcSet()` function in `imageOptimize.ts` always returns all 3 stored variants (200w, 400w, 800w) for pipeline images, regardless of what sizes the caller requested. Product cards only need up to 400w (on 2x screens at 200px display = 400px), but the browser picks 800w because of DPR.

**Fix in `src/lib/imageOptimize.ts`**: Filter `PIPELINE_WIDTHS` to only include variants up to the max requested size. When `ProductCardStyle1` calls `getImageSrcSet(url, [300, 400, 600])`, only return `200w, 400w` (skip 800w).

**Fix in `src/components/storefront/ProductCardStyle1.tsx`** (and Style2/3/4): Lower default quality from 75 to 65 for product cards to reduce image transfer size.

### 3. Fix robots.txt (SEO score)

Lighthouse reports "robots.txt is not valid — 1 error found". The file is missing a `Sitemap` directive and has redundant agent blocks.

**Fix**: Consolidate to standard format with a `Sitemap` entry.

### 4. Reduce LCP render delay via CSS critical path

The 310ms render-blocking CSS (`index-*.css`, 20KB, 17KB unused) delays FCP. The most impactful fix: inline the critical storefront CSS used above-the-fold (product card grid, nav) directly in `index.html`, and load the full stylesheet with `media="print" onload`.

**Fix in `index.html`**: Add `media="print" onload="this.media='all'"` to the CSS link tag for storefront routes. The inline skeleton CSS already covers initial paint.

---

### Expected Impact

| Change | Metric | Savings |
|--------|--------|---------|
| Admin chunk isolation | FCP, LCP, TBT | -320KB JS, -253ms main thread |
| Image srcSet fix | LCP | -54KB image, -300ms load |
| robots.txt fix | SEO | +8 points |
| CSS defer | FCP | -310ms render block |

### Files to modify
- `vite.config.ts` — Expand admin chunk pattern
- `src/lib/imageOptimize.ts` — Filter srcSet to requested sizes
- `src/components/storefront/ProductCardStyle1.tsx` — Lower quality to 65
- `src/components/storefront/ProductCardStyle2.tsx` — Lower quality to 65
- `src/components/storefront/ProductCardStyle3.tsx` — Lower quality to 65
- `src/components/storefront/ProductCardStyle4.tsx` — Lower quality to 65
- `public/robots.txt` — Fix format, add Sitemap
- `index.html` — Defer main CSS on storefront

