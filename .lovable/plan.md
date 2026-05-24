## Goal

Show the same nested-rings spinner loader (currently used for storefront cold loads) on every "blank wait" moment users currently see in the platform — dashboard, login, signup, partner login/dashboard, admin, and after dashboard refresh / PWA cold launch.

Today, only storefront hosts and the landing page get a branded loader. Everything else falls back to a plain white screen during the React bundle + auth check.

## What's in place today (`index.html`)

```text
#inline-skel  → nested-ring spinner (storefront cold load fallback)
#landing-skel → branded Bauhaus hero shell (shopbanao.in landing)

Visibility router (line ~506):
  if storefront host     → show #inline-skel
  else if landing path   → show #landing-skel (after 2s)
  else                   → HIDE BOTH   ← dashboard / login / partner = blank
```

The fade-out logic (`waitForPaint` polling `#root` height ≥ 120 → kill skel) already handles non-landing routes correctly — we just never let the skeleton appear for them.

## Change

### 1. `index.html` — visibility router (~lines 506–538)

Extend the "else" branch so `#inline-skel` stays visible on app-shell routes:

```text
dashboardPaths = /dashboard, /login, /signup, /admin, /partners/login,
                 /partners/dashboard, /partners (any /partners/* except landing),
                 /forgot-password, /reset-password, /auth/callback
```

For these paths:
- Keep `#inline-skel` shown (it's already mounted as `position:fixed; inset:0`).
- Switch its background + ring color to the platform brand (`#4361ee` primary, `#f8fafc` bg) instead of the storefront teal fallback, so it doesn't look "storey-ish" on the dashboard.
- Hide `#landing-skel`.

### 2. `index.html` — inline-skel styles (~line 306–316)

Add a `data-app-shell="1"` modifier the visibility router can toggle. When set, the spinner uses:
- `background: #f8fafc` (matches dashboard bg)
- ring `border-top-color: #4361ee` (platform primary)

Storefront/preview keeps the existing CSS-var theming (already working).

### 3. `index.html` — fade-out (~line 600–606)

Already correct: `waitForPaint` runs on non-landing routes once `DOMContentLoaded` fires, polls `#root` for real content, then crossfades the skel out. No change needed — just verify the 12s hard-kill remains.

### 4. Dashboard route boundary — keep skel until first paint

`<ProtectedRoute>` currently renders an empty `<div className="min-h-screen bg-background" />` while auth loads, which **paints into `#root` and trips `hasRealContent()` early**, killing the skel before the real dashboard mounts.

Fix: change that placeholder to a 0-height fragment (or `min-h-0`) so the skel stays up until `Dashboard.tsx` actually renders content. Same for any `loading` fallback inside `DashboardLayout` / partner layout that paints a full-screen empty div.

Files to touch:
- `src/components/ProtectedRoute.tsx` — return `null` instead of empty min-h-screen div
- `src/layouts/DashboardLayout.tsx` — verify its loading state doesn't paint a >120px placeholder
- `src/layouts/PartnerLayout.tsx` — same check
- `src/pages/StoresList.tsx` — its spinner div paints; switch to `return null` so the inline-skel stays visible until `/dashboard` actually mounts

### 5. PWA / refresh behavior

No code needed. Because `#inline-skel` is already in `index.html` and shown at T+0, every hard navigation (PWA cold start, browser refresh, address-bar load) automatically gets the spinner. Only SPA in-app navigations skip it (those use the existing `NavigationProgress` bar — correct behavior).

## Out of scope

- SPA-internal navigation loaders (already handled by `NavigationProgress`).
- Storefront skeleton (unchanged — Worker owns it).
- Landing skeleton (unchanged).

## Acceptance

| Scenario | Before | After |
|---|---|---|
| `shopbanao.in/login` cold | blank ~1.5s | spinner → form |
| `shopbanao.in/dashboard` cold | blank | spinner → dashboard |
| PWA launch into dashboard | blank | spinner → dashboard |
| Refresh on dashboard | blank | spinner → dashboard |
| Partner login/dashboard cold | blank | spinner → page |
| Landing `/` | branded hero skel (unchanged) | unchanged |
| Storefront cold | Worker skel (unchanged) | unchanged |
| SPA nav inside dashboard | top progress bar (unchanged) | unchanged |
