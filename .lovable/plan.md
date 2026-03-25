

# Storefront Performance Optimization Plan

## Root Cause Analysis

The current ~10s load has three main bottlenecks:

1. **Wasted prefetch — data fetched twice**: `index.html` fires an API call and stores the promise in `window.__STOREFRONT_PREFETCH__`, but the React app never reads it. It only checks `window.__STOREFRONT_DATA__` (which is only set by Cloudflare Worker injection). So React Query fires the same API call again — doubling network time.

2. **Sequential waterfall still exists**: Even with the parallel prefetch in `App.tsx`, the flow is: parse HTML → start JS download → execute JS → mount React → start layout chunk download → mount layout → `useStorefront` fires API call. The index.html prefetch was supposed to fix this but is broken (see #1).

3. **3 image variants uploaded per image**: Each product image upload creates 200w, 400w, and 800w variants. This triples upload time and storage, with minimal benefit (the 200w variant is rarely useful at 60KB).

## Changes (4 files)

### 1. Fix the broken prefetch bridge (`index.html` + `StorefrontLayout.logic.ts`)

The index.html script already fetches data early. Fix the handoff:
- In `index.html`: when the fetch resolves, store the result in `window.__STOREFRONT_DATA__` (not `__STOREFRONT_PREFETCH__`). This is the variable React already checks.
- In `StorefrontLayout.logic.ts`: also check `window.__STOREFRONT_PREFETCH__` as a fallback — if the promise exists but hasn't resolved yet, `await` it in the queryFn before making a new API call.

This single fix eliminates the duplicate API call and ensures data is available before React even mounts in many cases.

### 2. Reduce image variants from 3 to 2 (`imageCompression.ts` + `uploadOptimizedImage.ts` + `imageOptimize.ts`)

- Drop the 200w variant entirely. Product cards on mobile at 50vw on a 375px screen = 188px logical, but with 2x DPR the browser picks the 400w variant anyway. The 200w file is almost never served.
- Keep only **400w** and **800w** variants.
- Update `IMAGE_VARIANT_WIDTHS` from `[200, 400, 800]` to `[400, 800]`.
- Update `PIPELINE_WIDTHS` in `imageOptimize.ts` to match.
- Update `pickBestVariant` to only choose from `[400, 800]`.
- Update srcSet generation to emit 2 entries instead of 3.

This cuts upload time by ~33% and reduces storage per image by ~33%.

### 3. Consume prefetch promise in React Query (`StorefrontLayout.logic.ts`)

Update the `queryFn` in `useStorefront`:

```text
queryFn: async () => {
  // 1. Use injected data (Cloudflare Worker)
  if (injected?.store) return injected;

  // 2. Await the index.html prefetch if still in flight
  const prefetch = (window as any).__STOREFRONT_PREFETCH__;
  if (prefetch) {
    const result = await prefetch;
    if (result?.store) {
      (window as any).__STOREFRONT_DATA__ = result;
      delete (window as any).__STOREFRONT_PREFETCH__;
      return result;
    }
  }

  // 3. Fresh RPC call (fallback)
  const { data, error } = await supabase.rpc(...);
  ...
}
```

### 4. Also consume prefetch in `App.tsx` usePrefetchStorefrontData

The `usePrefetchStorefrontData` hook in App.tsx also fires a duplicate call. Add a check: if `__STOREFRONT_PREFETCH__` or `__STOREFRONT_DATA__` exists, skip the prefetch entirely.

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Store resolved data in `__STOREFRONT_DATA__` instead of only `__STOREFRONT_PREFETCH__` |
| `src/layouts/StorefrontLayout.logic.ts` | Consume `__STOREFRONT_PREFETCH__` promise in queryFn |
| `src/App.tsx` | Skip prefetch when index.html prefetch is already in flight |
| `src/lib/imageCompression.ts` | Remove 200w variant, keep [400, 800] |
| `src/lib/uploadOptimizedImage.ts` | Upload 2 variants instead of 3 |
| `src/lib/imageOptimize.ts` | Update PIPELINE_WIDTHS to [400, 800], update srcSet |
| `src/components/storefront/OptimizedImage.tsx` | Update default srcSetSizes |

## Expected Impact

- **Eliminates duplicate API call**: saves 500ms–2s depending on network
- **Data available before React mounts**: when index.html prefetch resolves first, React gets instant cache hit — no loading state
- **Fewer image uploads**: 2 variants instead of 3, faster product creation
- **No architectural risk**: all changes are additive fixes to existing patterns

