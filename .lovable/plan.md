

# Performance Recovery Plan: 43 → 80+ Score

## Problem Analysis

Current cold-load timeline for a storefront visitor:

```text
0ms ─── Edge cache HIT (HTML returned)
 ├── HTML has document.write skeleton (gray boxes, no theme color)
 ├── Browser starts parsing JS chunks
200ms ── CSS loads, skeleton visible but GENERIC (wrong colors)
800ms ── React mounts, StorefrontShell renders ANOTHER skeleton
1200ms ─ Google Fonts request fires (render-blocking)
2500ms ─ Products fetch completes (/api/products)
3500ms ─ First meaningful paint with real content
```

**Root causes:**
1. **Double skeleton**: index.html has a generic gray skeleton via `document.write`, then React replaces it with ANOTHER skeleton from `StorefrontShell` — both are generic and don't match the store's theme
2. **JS waterfall**: Chunks load sequentially (framework → router → layout → home page) instead of in parallel
3. **Products not available at edge**: Even though store data is injected by Worker, products require a separate `/api/products` fetch after React mounts
4. **Google Fonts still block**: The `preload as="style" onload` pattern still causes a render delay

## Solution: Server-Side Skeleton + Instant Products

### Step 1: Theme-Aware Skeleton in Worker Response

Move skeleton generation INTO the Cloudflare Worker's `injectIntoHtml` function. Since the Worker already has the store's theme config (colors, logo, store name), it can generate a skeleton that:
- Uses the store's actual background color and primary color
- Shows the store's logo in the nav
- Matches the store's theme layout (categories, product grid)
- Is part of the cached HTML — so on edge cache HIT, the skeleton is **instant** (0ms)

```text
BEFORE: Edge HTML → generic gray skeleton → React mounts → themed skeleton → data loads → real UI
AFTER:  Edge HTML (with themed skeleton + inline products) → React mounts → real UI replaces skeleton
```

The Worker will inject a `<div id="sf-skel">` with inline styles using the theme's CSS variables that are already computed. React will simply remove this div when it mounts.

### Step 2: Remove Client-Side Skeletons

- Remove the `document.write` skeleton from `index.html` (Worker provides it now)
- Remove `DefaultSkeleton` from `StorefrontShell.tsx` (no longer needed since Worker skeleton is visible until React hydrates)
- Add a small script in `main.tsx` to remove the `#sf-skel` div once React mounts

### Step 3: Inline First 4 Products into HTML

The Worker already fetches storefront shell data. Extend this to include the first 4 products (above-fold only) as `window.__PRODUCTS_INLINE__`. This eliminates the products fetch waterfall entirely for above-fold content.

- Worker's `injectIntoHtml` will embed `<script>window.__PRODUCTS_INLINE__=JSON.stringify(first4Products)</script>`
- `useStorefrontProducts` hook checks this before fetching
- Full product list still loads via `/api/products` in background

### Step 4: Fix Google Fonts

Change the Worker's font injection from `preload + onload` to a non-blocking async pattern:
```html
<link rel="stylesheet" href="...fonts..." media="print" onload="this.media='all'" />
```
This loads fonts without blocking any rendering.

### Step 5: Strategic Module Preloads

The Worker knows which theme the store uses. Add `<link rel="modulepreload">` for theme-specific chunks (e.g., `StorefrontLayoutV14`, `StorefrontHomeV14`) so they load in parallel with the framework chunk instead of sequentially.

## Expected Impact

```text
BEFORE (cold load):
  0ms    → Generic gray skeleton
  800ms  → React skeleton (theme flash)
  2500ms → Products render
  Score: ~43

AFTER (cold load):
  0ms    → Themed skeleton with correct colors, logo, layout
  800ms  → React mounts, replaces skeleton with real content (products inline)
  Score: 80+
```

## Files Changed

| File | Change |
|---|---|
| `docs/cloudflare-worker-current.js` | Add themed skeleton + inline products to `injectIntoHtml` |
| `index.html` | Remove `document.write` skeleton block |
| `src/layouts/StorefrontShell.tsx` | Remove DefaultSkeleton, add `#sf-skel` cleanup |
| `src/hooks/useStorefrontProducts.ts` | Check `window.__PRODUCTS_INLINE__` before fetch |
| `src/main.tsx` | Remove `#sf-skel` div on mount |

## Technical Risks

- **Worker code size**: Adding skeleton HTML increases Worker response size by ~2KB — negligible vs the performance gain
- **Cache invalidation**: Skeleton is part of the cached HTML, so theme changes require cache purge (already handled by existing purge-store endpoint)
- **Preview/localhost**: Falls back to current client-side skeleton since Worker isn't active there

