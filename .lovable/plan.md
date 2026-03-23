

## Plan: Optimize Backend/Client Data Flow

### Current State Analysis

**Supabase on storefront critical path:**
- `StorefrontLayout.tsx` (line 6) directly imports `supabase` client — pulls `vendor-supabase` chunk (~40KB gzip) into every storefront page load
- `StorefrontAuthContext.tsx` (line 3) imports supabase — wraps the entire storefront tree
- `StorefrontHome.tsx` (line 6) imports supabase directly
- On cache-hit loads (injected data from Worker), the supabase client is **never called** — the `queryFn` returns the injected data immediately. Yet the entire SDK is still downloaded and parsed.

**Worker sequential fetching (line 546-549 of cloudflare-worker-fixed.js):**
```javascript
async function fetchAndInjectSlug(request, slug) {
  const storefrontData = await prefetchStorefrontData(slug);  // waits...
  return streamInjectedResponse(request, slug, storefrontData); // then fetches origin
}
```
`prefetchStorefrontData` completes BEFORE `proxyToOrigin` starts inside `streamInjectedResponse`. On cache miss, this adds ~200-400ms TTFB.

---

### Changes

#### 1. Lazy-load Supabase in storefront `useStorefront` hook
**File:** `src/layouts/StorefrontLayout.tsx`

Remove the top-level `import { supabase }` (line 6). In the `queryFn` of `useStorefront`, use dynamic `import()` only when the injected/cached data path is NOT taken (i.e., only on API fallback):

```typescript
// Remove: import { supabase } from "@/integrations/supabase/client";

// Inside queryFn, after checking injected + localStorage:
const { supabase } = await import("@/integrations/supabase/client");
const { data, error } = await supabase.rpc("get_storefront_data", ...);
```

This means on first load with Worker-injected data, the `vendor-supabase` chunk is **never downloaded**. It only loads when a background revalidation actually fires the API call.

#### 2. Lazy-load Supabase in StorefrontAuthContext
**File:** `src/contexts/StorefrontAuthContext.tsx`

Replace the static import with a lazy initialization pattern:

```typescript
// Remove: import { supabase } from "@/integrations/supabase/client";

let _supabase: any = null;
async function getSupabase() {
  if (!_supabase) {
    const mod = await import("@/integrations/supabase/client");
    _supabase = mod.supabase;
  }
  return _supabase;
}
```

Use `getSupabase()` in `useEffect`, `signUp`, `signIn`, `signOut`, and `fetchOrCreateCustomer`. The auth state listener setup becomes async but still fires before any user interaction.

#### 3. Lazy-load Supabase in StorefrontHome
**File:** `src/pages/StorefrontHome.tsx`

Same pattern — remove the static import, use dynamic import only in the specific `queryFn` that needs it (for loading more products). The initial product display uses pre-seeded React Query cache, not a supabase call.

#### 4. Lazy-load Supabase in storefront components
**Files:** `src/components/storefront/CartUpsell.tsx`, `PostPurchaseUpsell.tsx`, `ExitIntentPopup.tsx`

Same dynamic import pattern in their `queryFn` callbacks. These are already lazy-loaded components, so this is a minor win but ensures zero supabase in the initial bundle.

#### 5. Parallelize Worker data + origin fetches
**File:** `docs/cloudflare-worker-fixed.js`

Refactor `fetchAndInjectSlug` to run both operations concurrently:

```javascript
async function fetchAndInjectSlug(request, slug) {
  // Run both in parallel — origin fetch starts immediately
  const [storefrontData, originResponse] = await Promise.all([
    prefetchStorefrontData(slug),
    proxyToOrigin(request),
  ]);
  // Then inject into the already-fetched origin HTML
  return injectIntoResponse(originResponse, slug, storefrontData);
}
```

Refactor `streamInjectedResponse` to accept an already-fetched `originResponse` instead of calling `proxyToOrigin` internally. This eliminates the sequential wait (~200-400ms savings on cache miss).

#### 6. Fix unclosed brace bug in `proxyToOrigin`
**File:** `docs/cloudflare-worker-fixed.js` (lines 266-281)

The `else if` block for HTML content-type is missing a closing brace before the security headers loop — the security headers only apply to HTML responses instead of all responses. Fix the brace placement.

---

### Files to Modify

| File | Action |
|------|--------|
| `src/layouts/StorefrontLayout.tsx` | Remove static supabase import, use dynamic import in queryFn |
| `src/contexts/StorefrontAuthContext.tsx` | Lazy-init supabase with cached singleton pattern |
| `src/pages/StorefrontHome.tsx` | Dynamic import in queryFn |
| `src/components/storefront/CartUpsell.tsx` | Dynamic import in queryFn |
| `src/components/storefront/PostPurchaseUpsell.tsx` | Dynamic import in queryFn |
| `src/components/storefront/ExitIntentPopup.tsx` | Dynamic import in queryFn |
| `docs/cloudflare-worker-fixed.js` | Parallelize fetches + fix brace bug |

### What NOT to change
- `src/integrations/supabase/client.ts` — auto-generated, never edit
- Cart/Wishlist contexts — no supabase dependency
- Dashboard/Admin paths — already isolated in separate chunks
- `vite.config.ts` — chunk splitting already correct

### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Storefront initial JS (with injected data) | Includes ~40KB vendor-supabase | Deferred until needed |
| Worker TTFB on cache miss | Sequential (~600ms) | Parallel (~350ms) |
| TTI on cold load | Blocked by supabase parse | Supabase loads async after paint |
| Auth/checkout flows | Unchanged | Unchanged (supabase loads on demand) |

