

# Theme 8: "Mobile App" — Mobile-First Shopping Experience

## Concept
A **mobile-only** shopping app theme that feels like a native iOS/Android shopping app — not a responsive website. Pill-shaped search bar, circular category icons, swipeable hero banners, flash deal countdown timers, sticky bottom tab navigation, and generous 16px border radius everywhere.

**Unique from all 7 themes:**
- **Bottom tab bar with 5 tabs** (Home, Categories, Search, Wishlist, Profile) — Theme 3 has a bottom bar but this one is redesigned with pill-style active indicator
- **Pill-shaped search bar** centered in the header (not a sidebar search)
- **Flash Deals section** with live countdown timer — no other theme has this
- **Circular category icons** with horizontal scroll — distinct from Theme 3's rounded-square categories
- **Swipeable hero banner carousel** with dot indicators and rounded corners
- **16px border radius system** throughout — much rounder than any existing theme
- **7 vibrant mobile-specific color presets** (Purple+Pink, Black+Neon, Navy+Cyan, etc.)

## Files to Create (2)

### 1. `src/layouts/StorefrontLayoutV8.tsx` (~380 lines)
- **Header**: Compact sticky header — hamburger left, pill search bar center, cart icon right
- **Bottom Tab Bar**: 5 tabs (Home, Categories, Search, Wishlist, Profile) with pill-shaped active indicator and smooth transitions
- **No traditional footer on mobile** — bottom tab bar replaces it; footer only shows on md+ breakpoints
- Same provider wrapping pattern as all layouts (Cart, Wishlist, StorefrontAuth, SideCart, FloatingWhatsApp)

### 2. `src/pages/StorefrontHomeV8.tsx` (~500 lines)
- **Hero Carousel**: Embla-based swipeable banner with rounded-2xl corners, dot indicators, auto-play
- **Category Strip**: Horizontal scroll of circular icons with labels, smooth snap scrolling
- **Flash Deals**: Horizontal scroll product cards with countdown timer (hours:minutes:seconds), discount badges
- **Product Grid**: 2-column grid with 16px radius cards, soft shadows, wishlist heart, add-to-cart button
- **Trust Badges**: Compact strip with Free Shipping / Secure Payment / Easy Returns icons

## Files to Edit (2)

### 3. `src/App.tsx`
- Add `lazy` import for `StorefrontLayoutV8` and `StorefrontHomeV8`
- Add `theme-8` case in `ThemeAwareStorefront` layout/home selectors

### 4. `src/pages/StoreThemeSettings.tsx`
- Add `theme-8` to `THEMES` array with name "Mobile App" and description
- Add `theme-8` to `THEME_DEFAULTS` (Inter font, pill buttons, vibrant blue primary)
- Add 7 mobile-specific color presets (`mob-purple-pink`, `mob-blue-orange`, `mob-black-neon`, `mob-navy-cyan`, `mob-teal-white`, `mob-gradient-purple`, `mob-beige-brown`)
- Add `MobileAppPreview` component for the theme settings preview card

## Technical Details
- Uses Embla Carousel (already installed) for hero swipe
- Flash deal countdown uses `useState` + `useEffect` interval ticking down from a seeded time
- Bottom tab bar uses `useLocation` to highlight active tab, includes `safe-area-inset-bottom` padding
- All cards use `rounded-2xl` (16px), `shadow-sm`, consistent spacing system (p-4, gap-3, space-y-8)
- Lazy-loaded via `React.lazy()` — zero bundle impact on other themes

