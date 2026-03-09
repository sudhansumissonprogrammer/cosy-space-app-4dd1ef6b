

## Problem Analysis

The remaining ~5s delay has two causes:

1. **AuthProvider blocks storefront** — `AuthProvider` wraps ALL routes including public `/store/:slug`. It calls `supabase.auth.getSession()` on mount, adding ~1-2s network time before anything renders. Storefront visitors don't need authentication.

2. **Full-screen spinner during data fetch** — `StorefrontLayout` shows a blank spinner while fetching store data (~1-2s). Users see nothing meaningful during this time.

## Plan

### 1. Move storefront routes outside AuthProvider

Restructure `App.tsx` so `/store/:slug` routes render without `AuthProvider`. This eliminates the auth session call for public visitors.

```
<BrowserRouter>
  {/* Public storefront — no auth needed */}
  <Routes>
    <Route path="/store/:slug" ... />
  </Routes>

  {/* Everything else wrapped in AuthProvider */}
  <AuthProvider>
    <Routes>
      <Route path="/login" ... />
      <Route path="/dashboard" ... />
      ...
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

This will be implemented by splitting routes into two groups using a small routing component.

### 2. Replace spinner with skeleton layout in StorefrontLayout

Instead of a blank spinner while store data loads, show an instant skeleton that matches the real layout (marquee bar + nav bar + content placeholders). Users see the page structure immediately.

### Files to change:
- **`src/App.tsx`** — Split routes so storefront bypasses AuthProvider
- **`src/layouts/StorefrontLayout.tsx`** — Replace loading spinner with skeleton shell

### Expected impact:
- Eliminates ~1-2s auth overhead for storefront visitors
- Perceived load feels instant (skeleton appears in <500ms)
- No impact on dashboard/admin functionality

