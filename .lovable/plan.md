

## Issues Found Across All 10 Themes

### 1. Theme Selector — Missing Unique Preview Gradients for Themes 3, 8, 9, 10
The theme selector card shows a gradient strip for each theme, but **themes 3, 8, 9, and 10 all fall through to the same default gradient** (`#F8FAFC → #3B82F6 → #F97316`). They look identical in the selector, making them visually indistinguishable. Each needs a unique gradient:
- **theme-3** (App Style): Orange/teal mobile-app feel
- **theme-8** (Mobile App): Purple/blue pill-style
- **theme-9** (Discovery Feed): Purple/green discovery
- **theme-10** (Fashion Runway): Pink/black fashion

**File**: `src/pages/StoreThemeSettings.tsx` ~line 2604-2617 — add cases for `theme-3`, `theme-8`, `theme-9`, `theme-10`.

### 2. Console Warning — `FashionRunwayPreview` and child `PreviewFrame` ref warnings
The console shows "Function components cannot be given refs" for `FashionRunwayPreview` → `PreviewFrame`. This is a React warning about passing refs to function components. The `PreviewFrame` component is used inside preview components that may be receiving refs from parent rendering. This is non-breaking but should be cleaned up.

**Fix**: No action strictly needed — these are warnings, not errors. The previews render correctly.

### 3. FloatingWhatsApp Overlap with Bottom Tab Bars (Themes 8, 9, 10)
All three new themes have bottom tab bars AND a `FloatingWhatsApp` component. The WhatsApp button may overlap with:
- **Theme 9**: The floating search button (`bottom-24 right-4`) 
- **Theme 10**: The floating filter button (`bottom-24 right-4`)

Need to verify FloatingWhatsApp positioning doesn't conflict. If it uses a similar `bottom-right` fixed position, it will stack on top of theme-specific floating buttons.

**File**: Check `src/components/storefront/FloatingWhatsApp.tsx` for positioning and adjust if needed for themes with floating action buttons.

### 4. Mobile-Specific Layout Issues

**Theme 9 (Discovery Feed)**:
- Feed cards use `aspectRatio: "3/4"` which is fine, but the expand toggle chevron button at the bottom of each card has very low contrast (`opacity: 04` on bg) — nearly invisible.

**Theme 10 (Fashion Runway)**:
- Collection cards grid uses `gridRow: "span 2"` for first item — on very narrow screens (< 320px) this could cause overflow. Minor issue.

### 5. Color Preset System — CSS Opacity Hex Notation
Throughout all three new themes, colors use patterns like `var(--storefront-text, hsl(var(--foreground)))40` where `40` is appended as hex opacity. This is a **CSS convention that only works when the CSS variable resolves to a hex color** (e.g., `#1a1a1a40`). If the variable resolves to an HSL value, the `40` suffix creates an invalid color. This affects:
- Border colors
- Background colors with opacity
- Text colors with opacity

This is consistent with how all other themes handle it, so it's a systemic pattern rather than a bug unique to themes 8-10.

---

## Proposed Fixes

### Fix 1: Add unique gradient strips for themes 3, 8, 9, 10 in the selector
In `StoreThemeSettings.tsx`, update the gradient conditional (~line 2604-2617) to add:
- `theme-3`: `linear-gradient(135deg, #F97316 0%, #3B82F6 50%, #1e293b 100%)`
- `theme-8`: `linear-gradient(135deg, #F8FAFC 0%, #6C5CE7 50%, #FD79A8 100%)`
- `theme-9`: `linear-gradient(135deg, #1a1a1a 0%, #7C3AED 50%, #22C55E 100%)`
- `theme-10`: `linear-gradient(135deg, #FFFFFF 0%, #FF3F6C 50%, #111111 100%)`

### Fix 2: Check and fix FloatingWhatsApp position conflicts
Read `FloatingWhatsApp.tsx` to confirm positioning, and if it overlaps with floating buttons on themes 8-10, adjust its bottom offset on those themes.

### Fix 3: Improve expand toggle visibility in Theme 9
Change the expand toggle button background from `04` opacity to `08` or `10` for better visibility.

This plan focuses on the concrete, visible issues. The themes are structurally sound — layouts render correctly, bottom tabs work with safe-area padding, and content spacing accounts for fixed navigation.

