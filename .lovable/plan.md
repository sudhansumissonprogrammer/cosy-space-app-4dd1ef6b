

## Problem: Slow First Load, Instant on Refresh

This is a classic **cold start vs warm cache** issue. Here is what happens:

**First visit**: Browser downloads the entire JS bundle (all 30+ page components eagerly imported), CSS, Google Fonts, then makes Supabase API calls sequentially. Everything is fetched from scratch.

**Second visit / refresh**: Browser has cached JS/CSS/fonts, React Query has cached data (5-min staleTime), so the page renders almost instantly.

## Root Cause

Every page in the app is **eagerly imported** in `App.tsx` — all 30+ components (admin pages, dashboard pages, storefront pages) are bundled into a single JS file. A visitor opening `/store/trendymart-india` downloads code for the admin panel, login, dashboard, etc. — none of which they need.

## Plan

### 1. Lazy-load all route components in `App.tsx`

Replace all static imports with `React.lazy()` + `Suspense`. This splits the bundle so only the storefront code loads when visiting `/store/:slug`.

**Before:**
```ts
import StorefrontHome from "./pages/StorefrontHome";
import AdminOverview from "./pages/admin/AdminOverview";
// ... 30+ imports
```

**After:**
```ts
const StorefrontLayout = lazy(() => import("./layouts/StorefrontLayout"));
const StorefrontHome = lazy(() => import("./pages/StorefrontHome"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
// etc.
```

Wrap `<Routes>` in `<Suspense fallback={<LoadingSpinner />}>`.

### 2. Keep critical components eagerly loaded

Only `AuthProvider`, `BrowserRouter`, `QueryClientProvider`, and the shell UI components stay eagerly imported since they're needed on every route.

### Files to change:
- **`src/App.tsx`** — Convert ~30 static imports to `React.lazy()`, add `Suspense` wrapper with a minimal loading spinner

### Expected impact:
- Storefront visitors download only storefront code (~30-40% of current bundle)
- First load should drop from 5-8s to 2-3s
- No change to refresh behavior (stays instant)

