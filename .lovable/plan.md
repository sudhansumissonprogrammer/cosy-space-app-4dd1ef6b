

# Theme 17 — "Luxe Mobile" (Premium Mobile-First Storefront)

## Summary
Create a new storefront theme (theme-17) that is mobile-optimized with a premium, modern aesthetic. It will use Alegreya SC for headings, unique component layouts distinct from all existing themes, and a carefully curated color palette. Every section — hero, categories, products, best sellers, footer — will have a fresh design.

## What Makes It Different
- **Glassmorphism hero** with gradient overlay and floating store name badge
- **Horizontal pill-style category scroller** with gradient backgrounds (not grid/carousel like other themes)
- **Stacked product cards** with full-bleed images, floating price badges, and swipe-to-cart gesture area
- **Sticky "Shop Now" floating action bar** on mobile (replaces standard bottom nav)
- **Animated section dividers** with wave/curve SVG separators between sections
- **New product card style (style-5)** — full-width image with overlay gradient, price/discount as floating pill, add-to-cart as a swipe-up drawer trigger

## Files to Create

| File | Purpose |
|------|---------|
| `src/layouts/StorefrontLayoutV17.tsx` | Layout shell — uses StorefrontShell with custom mobile nav |
| `src/pages/StorefrontHomeV17.tsx` | Home page with unique section ordering and designs |
| `src/components/storefront/ProductCardStyle5.tsx` | New card style — full-bleed image with overlay info |
| `src/components/storefront/MobileBottomNavV17.tsx` | Floating pill-style bottom nav with glassmorphism |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add lazy imports for LayoutV17, HomeV17; add theme-17 to switch cases |
| `src/pages/StoreThemeSettings.tsx` | Add theme-17 to THEMES array, THEME_DEFAULTS, THEME_RECOMMENDATIONS; add style-5 card option |
| `src/components/storefront/UniversalProductCard.tsx` | Add style-5 case rendering ProductCardStyle5 |

## Design Specifications

**Color Palette (Default):**
- Primary: `#1B1B3A` (deep navy)
- Accent: `#F56E0F` (warm orange)
- Text: `#1a1a1a`
- Background: `#FAFAF8` (warm white)
- Marquee: `linear-gradient(90deg, #1B1B3A, #F56E0F, #1B1B3A)`

**Typography:**
- Headings: Alegreya SC (as requested)
- Body: Inter

**Mobile-First Layout (Home Page sections top to bottom):**
1. **Glassmorphism Hero** — Full-width mobile hero with frosted-glass store name overlay, CTA button with pulse animation
2. **Pill Categories** — Horizontal scroll of rounded-pill category chips with subtle gradient fills
3. **Best Sellers Showcase** — Large featured card (first item) + 2-column grid below; section has a curved wave top border
4. **Trending Now Strip** — Horizontal scroll of compact square cards with product name overlay
5. **All Products Grid** — 2-col mobile, 4-col desktop with style-5 cards; infinite scroll
6. **Trust Strip** — Existing component
7. **Instagram Section** — Existing component (lazy)

**ProductCardStyle5 Design:**
- Full-bleed rounded image (aspect-ratio 3:4)
- Gradient overlay at bottom (transparent to dark)
- Product name + price rendered over the image in white
- Discount badge as floating pill top-right
- Wishlist heart icon top-left with glassmorphism circle background
- Add-to-cart button slides up on hover/tap as a thin bar at the bottom

**MobileBottomNavV17 Design:**
- Floating pill bar (not full-width), centered, with glassmorphism blur background
- 4 items: Home, Shop, Wishlist, Cart (with item count badge)
- Active item has accent-colored dot indicator below icon
- Hidden during checkout

## Implementation Order
1. Create ProductCardStyle5 component
2. Create MobileBottomNavV17 component
3. Create StorefrontHomeV17 page
4. Create StorefrontLayoutV17 layout
5. Wire into App.tsx (lazy imports + switch cases)
6. Add theme-17 config to StoreThemeSettings.tsx (THEMES, THEME_DEFAULTS, THEME_RECOMMENDATIONS)
7. Add style-5 to UniversalProductCard switch

