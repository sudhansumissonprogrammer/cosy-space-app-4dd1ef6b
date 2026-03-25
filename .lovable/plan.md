

## Optimize Theme Architecture: Eliminate Duplication, Reduce Bundle Size

### Current State (confirmed by code inspection)

Every layout file (11 total, 280-590 lines each) copy-pastes:
- `useStorefront()` call + loading/error handling (~10 lines)
- `useFacebookPixel`, `useMetaTags`, `trackPageView` (~15 lines)
- `useStorefrontThemeConfig` + Google Fonts useEffect (~15 lines)
- `useThemePreview` + `computePrimaryLight` + `isLightColor` + CSS var builder (~40 lines)
- Provider wrapping: `CartProvider > WishlistProvider > StorefrontAuthProvider` (~6 lines)
- Skeleton component (~30 lines)
- Store-not-found fallback (~10 lines)
- Badge components (CartBadge, WishlistBadge, AccountBadge) — renamed per theme but identical logic (~50 lines)

**Total duplicated: ~4,500 lines across 11 files.**

Each theme also eagerly imports `SideCart`, `FloatingWhatsApp`, `StorefrontFooter`, `DynamicPwaManifest`, `SmartInstallPrompt` — all bundled into the theme chunk instead of shared.

### Architecture Change

```text
BEFORE: App.tsx → ThemeLayout (heavy, 300-500 lines, all logic inside)

AFTER:  App.tsx → StorefrontShell (shared logic, providers, overlays)
                    → ThemeLayout (thin, 50-80 lines, header/nav only)
```

### Implementation Plan

**Step 1: Create `src/lib/themeUtils.ts`**

Extract pure functions duplicated in every layout:
- `computePrimaryLight(hex)`
- `isLightColor(hex)`
- `buildThemeStyle(themeConfig, previewOverride)`

~25 lines, imported by Shell.

**Step 2: Create shared badge components**

New files:
- `src/components/storefront/StorefrontCartBadge.tsx` — accepts `className` and `iconSize` props
- `src/components/storefront/StorefrontWishlistBadge.tsx`
- `src/components/storefront/StorefrontAccountBadge.tsx`

Each is ~20 lines. Themes import with style props instead of copy-pasting.

**Step 3: Create `src/layouts/StorefrontShell.tsx`**

This is the core change (~150 lines). It handles:
1. `useStorefront(slugOverride)` — data loading
2. Loading skeleton + store-not-found fallback
3. Provider wrapping (Cart, Wishlist, Auth)
4. Theme CSS variable computation via `buildThemeStyle()`
5. Google Fonts loading useEffect
6. `useFacebookPixel`, `useMetaTags`, `trackPageView`
7. `useThemePreview`
8. Lazy overlays: `SideCart`, `FloatingWhatsApp`, `ExitIntentPopup`, `DynamicPwaManifest`, `SmartInstallPrompt`
9. `StorefrontFooter` (shared across all themes except V13)

Renders children via render prop:
```tsx
children({ store, slug, themeConfig, primaryColor, btnTextColor })
```

**Step 4: Convert theme layouts to thin wrappers**

Each layout shrinks to ~50-80 lines containing ONLY:
- Theme-specific header/nav component
- `<Outlet />`
- Any truly unique UI (e.g., V13's WhatsApp order bar, V1's checkout exit dialog)

Example (StorefrontLayoutV2 after):
```tsx
export default function StorefrontLayoutV2({ slugOverride }) {
  return (
    <StorefrontShell slugOverride={slugOverride} showFooter>
      {({ store }) => (
        <>
          <TransparentNav store={store} />
          <main><Suspense fallback={...}><Outlet context={store} /></Suspense></main>
        </>
      )}
    </StorefrontShell>
  );
}
```

V2 drops from 304 lines → ~80 lines.

**Step 5: Handle V13 (restaurant theme) specially**

V13 is unique — no WishlistProvider, no SideCart, has WhatsApp order bar instead. Shell accepts props:
- `showWishlist?: boolean` (default true, false for V13)
- `showSideCart?: boolean` (default true, false for V13)
- `showFooter?: boolean` (default true)

V13 renders its own `WhatsAppOrderBar` inside children.

**Step 6: Update `App.tsx`**

No changes needed — `ThemeAwareStorefront` already lazy-loads layout components. The Shell is imported by each layout, so it goes into the `storefront-core` chunk automatically.

**Step 7: Update Vite `manualChunks`**

```js
manualChunks(id) {
  // Storefront shared core — loaded once
  if (id.includes("/layouts/StorefrontShell") ||
      id.includes("/lib/themeUtils") ||
      id.includes("/components/storefront/StorefrontFooter") ||
      id.includes("/components/storefront/SideCart") ||
      id.includes("/components/storefront/FloatingWhatsApp") ||
      id.includes("/components/storefront/StorefrontCartBadge") ||
      id.includes("/components/storefront/StorefrontWishlistBadge") ||
      id.includes("/components/storefront/StorefrontAccountBadge") ||
      id.includes("/contexts/CartContext") ||
      id.includes("/contexts/WishlistContext") ||
      id.includes("/contexts/StorefrontAuthContext")) {
    return "storefront-core";
  }
  // Existing theme chunks (now much smaller)
  // ... keep existing theme chunking
}
```

### Migration Order (safe, incremental)

1. `themeUtils.ts` + badge components (no breaking changes, just new files)
2. `StorefrontShell.tsx` (new file, not used yet)
3. Convert `StorefrontLayout.tsx` (theme-1) to use Shell — validate
4. Convert remaining themes one by one (V2, V3, V4, V6, V7, V8, V10, V11, V12, V13)
5. Update Vite manualChunks
6. Remove dead code (old badge functions, duplicated utils)

### Expected Results

| Metric | Before | After |
|---|---|---|
| Per-theme chunk | 80-124KB | 20-40KB |
| Shared core (new) | N/A | ~80KB (loaded once) |
| Total cold-load JS | ~160KB gz | ~100KB gz |
| Duplicated lines | ~4,500 | 0 |
| Files changed | 0 | 15 (11 layouts + 4 new) |

### What This Does NOT Do (intentionally)

- Does NOT change any visual output — same components render
- Does NOT touch `useStorefront()` logic — it moves into Shell unchanged
- Does NOT require SSR or framework changes
- Does NOT break Cloudflare Worker integration
- Does NOT change routing in App.tsx

