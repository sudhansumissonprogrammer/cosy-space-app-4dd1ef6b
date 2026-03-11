

# Theme 7: "Magazine" — Editorial Storytelling Layout

## Concept
A **content-driven, editorial magazine-style** theme that none of the existing 6 themes cover. Think Vogue meets Shopify — full-width cinematic image blocks, horizontal scroll product "stories," bold oversized typography, and an immersive reading-like flow with alternating left/right content sections.

**What makes it unique from all 6 themes:**
- **Horizontal scroll product showcase** (no other theme has this)
- **Split-screen alternating sections** — image left / text right, then flip
- **Oversized display typography** with a newspaper/magazine editorial feel
- **Marquee-style category ticker** at the top below the header
- **Minimal, borderless product cards** — no shadows, no borders, just image + text
- **Sticky side navigation dots** for section scrolling (desktop)

## Files to Create (2 new files)

### 1. `src/layouts/StorefrontLayoutV7.tsx` (~350 lines)
- **Header**: Ultra-thin sticky header (56px) with centered logo, left hamburger, right icons. White background with a single bottom border line. No glass/blur effects — pure editorial simplicity.
- **Category Ticker**: A subtle horizontal auto-scrolling marquee of category names below the header (like news tickers).
- **Footer**: Minimal 2-column footer — brand + links on left, newsletter on right.
- Wraps CartProvider, WishlistProvider, StorefrontAuthProvider, SideCart, FloatingWhatsApp as all other layouts do.

### 2. `src/pages/StorefrontHomeV7.tsx` (~450 lines)
- **Hero**: Full-width split — left half is a massive product image edge-to-edge, right half is store name in huge display text (80px+) with a "Shop Collection" CTA. On mobile, stacks vertically.
- **Horizontal Product Carousel**: A full-width horizontal scroll strip of products with large cards (300px wide), snap scrolling, showing image + name + price only. Minimalist.
- **Alternating Feature Sections**: 2-3 sections alternating image/text sides — e.g., "Our Story" with a large image on left and text on right, then "Bestsellers" with a grid on left and editorial text on right.
- **Category Grid**: Full-bleed 3-column grid with category images and overlay text, like magazine section dividers.
- **Testimonial Strip**: Single-line scrolling testimonial with large quote marks.
- **Newsletter**: Full-width dark background band with centered email input.

## Files to Edit (3 existing files)

### 3. `src/App.tsx`
- Add lazy import for `StorefrontLayoutV7` and `StorefrontHomeV7`
- Add `theme-7` case in `ThemeAwareStorefront` layout selector and `storefrontChildRoutes`

### 4. `src/pages/StoreThemeSettings.tsx`
- Add `theme-7` to `THEMES` array: `{ id: "theme-7", name: "Magazine", description: "Editorial storytelling with horizontal scrolls & cinematic imagery", available: true }`
- Add `theme-7` default config in `THEME_DEFAULTS`
- Add `MagazinePreview` component for the theme settings preview
- Add `theme-7` case in the preview rendering conditional
- Add gradient swatch for theme card

## Technical Details

- Follows the same provider/context pattern as V2-V6 (CartProvider, WishlistProvider, etc.)
- Uses existing `StorefrontProductCard`, `StorefrontFooter`, `SideCart`, `FloatingWhatsApp` components
- Lazy-loaded via `React.lazy()` — zero impact on other themes' bundle size
- Uses existing CSS custom properties (`--storefront-primary`, `--storefront-heading-font`, etc.)
- Mobile-responsive from the start: horizontal scroll uses `overflow-x-auto snap-x`, split sections stack on mobile
- Uses `storefrontPath()` for all links, `optimizeImageUrl()` for images

