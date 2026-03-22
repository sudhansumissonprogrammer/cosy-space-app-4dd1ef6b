

## Problem

When clicking any link in the dashboard, admin panel, or storefront, the **entire screen goes white** while the new page's JS chunk downloads. This happens because:

1. Every page is `lazy()` loaded
2. There's only ONE `Suspense` boundary at the app root with a full-screen spinner
3. When React switches routes, it unmounts the current page and shows the spinner — causing the white flash

Shopify/WordPress don't have this because they keep the current page visible until the next one is ready.

## Solution: Two changes

### 1. Add `Suspense` boundaries INSIDE each layout (keeps shell visible)

Wrap the `<Outlet />` in `DashboardLayout.tsx`, `AdminLayout.tsx`, and `StorefrontLayout.tsx` (+ all V2-V13 variants) with a local `<Suspense>` that shows a **content-area skeleton** instead of a full-screen spinner. This way the sidebar, header, and bottom nav **stay visible** while only the content area shows a loading state.

```text
Before:  [Sidebar] [White screen / spinner]
After:   [Sidebar] [Content skeleton pulse]
```

**Files to edit:**
- `src/layouts/DashboardLayout.tsx` — wrap `<Outlet />` in `<Suspense fallback={<ContentSkeleton />}>`
- `src/layouts/AdminLayout.tsx` — same pattern (both mobile and desktop renders)
- `src/layouts/StorefrontLayout.tsx` + all V2, V3, V4, V6, V7, V8, V10, V11, V12, V13 variants — wrap `<Outlet />` in `<Suspense>` with a storefront-appropriate skeleton

### 2. Use `startTransition` for all navigation (keeps old page visible)

React's `startTransition` tells React to keep showing the current UI while the new lazy component loads. We'll create a custom `useNavigateTransition` hook that wraps `useNavigate` with `startTransition`, then use it in:

- `DashboardLayout.tsx` (mobile menu `go()` function, bottom nav)
- `AdminLayout.tsx` (mobile menu, bottom nav)
- `NavLink.tsx` component (sidebar links)

**New file:** `src/hooks/useNavigateTransition.ts`
```typescript
import { useNavigate } from "react-router-dom";
import { useTransition, useCallback } from "react";

export function useNavigateTransition() {
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  
  const navigateWithTransition = useCallback(
    (to: string) => {
      startTransition(() => { navigate(to); });
    },
    [navigate, startTransition]
  );

  return { navigate: navigateWithTransition, isPending };
}
```

### 3. Add a subtle top loading bar (optional polish)

Use `isPending` from the transition hook to show a thin animated progress bar at the top of the layout (like Shopify's blue bar), giving visual feedback that navigation is in progress without removing the current content.

### Summary of file changes

| File | Change |
|------|--------|
| `src/hooks/useNavigateTransition.ts` | New hook wrapping navigate with startTransition |
| `src/layouts/DashboardLayout.tsx` | Wrap Outlet in Suspense + use transition navigate |
| `src/layouts/AdminLayout.tsx` | Same |
| `src/layouts/StorefrontLayout.tsx` | Wrap Outlet in Suspense |
| `src/layouts/StorefrontLayoutV2-V13.tsx` | Wrap Outlet in Suspense (10 files) |
| `src/components/NavLink.tsx` | Use transition navigate for sidebar links |
| `src/App.tsx` | Keep root Suspense but with a less jarring fallback |

This eliminates the white flash entirely — the current page stays visible until the next page is ready, exactly like Shopify.

