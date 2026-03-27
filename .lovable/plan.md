
Goal: make the storefront cold load feel faster by removing the expensive “2 real product cards first” behavior and removing animated shimmer on the storefront loading path.

What I’ll change

1. Remove the injected 2-product preview from the HTML shell
- In `docs/cloudflare-worker-current.js`:
  - Remove the `_initialProducts` fetch inside `_fetchShellFromSupabase()`
  - Stop fetching products during shell generation
  - Remove product-image preload generation from `injectIntoHtml()`
  - Remove any HTML injection logic that inserts the first 1–2 real product cards
- Result:
  - Smaller HTML
  - No product DB/API work in the shell path
  - No “2 photos appear first” effect

2. Simplify the `index.html` startup script
- In `index.html`:
  - Remove the fallback logic that:
    - calls `get_storefront_data`
    - preloads first/second product images
    - injects real product cards into `.sf-skel-grid`
    - resolves `__PRODUCTS_PREFETCH__` from prefetched product data
  - Keep only the minimum shell/bootstrap behavior needed for store data, or trim it further so React owns the product rendering
- Result:
  - Less main-thread work before React mounts
  - No duplicate “fake fast” product rendering that still feels slow

3. Replace shimmer with static placeholders
- In `index.html`:
  - Remove `@keyframes shimmer`
  - Replace `.sk-shimmer` animated gradient with flat static placeholder styles
- In storefront React skeletons:
  - Update storefront-specific loading placeholders to avoid animation:
    - `src/pages/StorefrontHome.tsx`
    - `src/layouts/StorefrontShell.tsx`
    - possibly `src/components/ContentSkeleton.tsx` if used on storefront
- I will avoid changing every app skeleton globally unless needed, so dashboard/admin screens keep their existing behavior.
- Result:
  - Less CPU/GPU work
  - Cleaner, calmer loading state
  - Better perceived cold-load performance

4. Keep product loading asynchronous and normal
- Keep `useStorefrontProducts()` as the real product source
- Let products render once the actual `/api/products` or preview fallback returns
- Ensure the home page shows stable static placeholders until real cards load, instead of mixing injected cards + later hydration
- Result:
  - More consistent first render
  - No odd visual jump from 2 cards to full list

5. Tighten storefront loading UX so it feels fast
- In `src/pages/StorefrontHome.tsx`:
  - Reduce above-the-fold skeleton complexity if needed
  - Keep category + product placeholder sizes stable, but lightweight
  - Preserve the optional mobile hero upload feature already in store settings
- In `src/layouts/StorefrontShell.tsx`:
  - Simplify the default storefront loading fallback if it’s heavier than needed
- Result:
  - Faster-feeling cold load without changing store features

Why this should help
- Right now, the slow/odd behavior comes from two places:
  1. the Worker shell path still prepares inline product preview data
  2. `index.html` still does heavy pre-React work and animates shimmer placeholders
- Removing both makes the shell truly lightweight:
  - shell = store structure only
  - products = loaded normally after boot
  - placeholders = static, low-cost

Files likely involved
- `docs/cloudflare-worker-current.js`
- `index.html`
- `src/pages/StorefrontHome.tsx`
- `src/layouts/StorefrontShell.tsx`
- possibly `src/components/ContentSkeleton.tsx`

Technical details
```text
Before:
request -> worker shell -> shell data + initial products + image preload + HTML injection
       -> index.html prefetch -> preload more images + replace skeleton cards
       -> React hydration -> full product fetch/render

After:
request -> worker shell -> shell data only
       -> static lightweight skeleton
       -> React hydration
       -> normal product fetch/render
```

Expected outcome
- No more 2 product images appearing first
- No shimmer animation on storefront cold load
- Smaller shell payload
- Lower main-thread work before hydration
- Better perceived cold-load speed, especially on first visit

Implementation priority
1. Remove Worker inline product injection
2. Remove `index.html` hybrid product injection/preload code
3. Convert storefront placeholders from shimmer to static
4. Simplify storefront loading skeletons without removing the mobile hero setting feature
