## Goal
Add all 10 premium font combination presets ("Swiggy", "Tanishq Luxury", "Glossier", etc.) as one-click brand-style presets in the Theme → Typography page. When a merchant clicks a preset and saves, the **entire storefront** (headings, product titles, body, buttons, prices) instantly adopts that brand's exact typography — fonts, weights, casing, and letter-spacing.

## What changes in the Dashboard (StoreThemeSettings.tsx)

Keep the existing small "Font Combinations" block untouched, and add a new dedicated section below it:

**New section: "Premium Brand Presets"** (10 large cards in a 1-col mobile / 2-col desktop grid)

Each card renders a true-to-spec live preview:
```
┌─────────────────────────────────┐
│ SWIGGY STYLE      [FOOD/D2C] ✓ │
│ Your Store Name      (Manrope 800, -1px)
│ Beautiful Product   (Manrope 600)
│ Soft cotton kurti…  (Manrope 400)
│ [ ADD TO CART ]     (Manrope 700, UPPER, +0.5)
│ ₹1,299              (Manrope 800)
└─────────────────────────────────┘
```
Click → applies preset → saves → storefront updates instantly.

## The 10 presets (with full typographic spec)

| # | Name | Heading | Body | Btn case | Btn track | Best for |
|---|------|---------|------|----------|-----------|----------|
| 1 | Swiggy Style | Manrope 700 | Manrope 400 | UPPER | 0.5 | Food / quick commerce |
| 2 | Luxury Editorial | Playfair Display 700 (-0.5) | Inter 400 | UPPER | 1.5 | Jewellery |
| 3 | Modern Glossier | Fraunces 600 | Inter 400 | sentence | 0 | Beauty / wellness |
| 4 | Soft Luxury | Cormorant Garamond 300 | Montserrat 400 | UPPER | 2.0 | Designer fashion |
| 5 | Bold Editorial | DM Serif Display 400 | Jost 400 | sentence | 0 | Apparel / lifestyle |
| 6 | Airbnb Modern | Plus Jakarta 800 (-1) | Plus Jakarta 400 | sentence | 0 | Home / travel |
| 7 | Gucci Ultra-Luxury | Bodoni Moda 700 (-0.5) | Inter 400 | UPPER | 2.5 | Perfume / luxury |
| 8 | CRED Bold | Syne 800 (-1) | Inter 400 | sentence | 0 | Sneakers / gen-z |
| 9 | Royal Indian | Marcellus 400 (+1) | Poppins 400 | UPPER | 1.5 | Bridal / ethnic |
| 10 | Minimal Modern | DM Sans 700 (-0.5) | DM Sans 400 | sentence | 0 | Electronics / minimal |

## How the storefront actually uses the weights/casing

Today the storefront only consumes `--storefront-heading-font` and `--storefront-body-font`. To honor weight/casing/tracking, I'll:

1. **Extend `theme_config`** with one new column: `font_preset` (text, nullable) — stores the preset id. No schema breakage; column already small.
2. **Inject 6 new CSS vars** in `buildThemeStyle()` based on the active preset:
   - `--storefront-heading-weight` (e.g. 700)
   - `--storefront-heading-tracking` (e.g. -0.5px)
   - `--storefront-body-weight` (400)
   - `--storefront-btn-weight` (700)
   - `--storefront-btn-case` (uppercase / none)
   - `--storefront-btn-tracking` (0.5px)
   - `--storefront-price-weight` (800)
3. **Add 5 small CSS rules** in `index.css` under `.storefront-font` scope:
   - `h1,h2,h3,h4 { font-weight: var(--storefront-heading-weight); letter-spacing: var(--storefront-heading-tracking); }`
   - Storefront `<button>` primary → uses btn-weight, btn-case (text-transform), btn-tracking
   - `.sf-price` class → uses price-weight
4. **Tag price spans** with `className="sf-price"` in 4 spots (ProductCard, ProductDetail, CartItem, CheckoutSummary).

## Files to touch
- `src/pages/StoreThemeSettings.tsx` — expand FONT_COMBINATIONS to 10 full presets with weights/casing, add "Premium Brand Presets" section with realistic preview cards
- `src/lib/themeUtils.ts` — extend `buildThemeStyle()` to emit the 6 new CSS vars from the active preset
- `src/hooks/useThemePreview.ts` — mirror the same 6 vars for live iframe preview
- `src/index.css` — add `.storefront-font` rules consuming the new vars
- `src/components/storefront/ProductCard.tsx`, `pages/ProductDetail.tsx`, `pages/CartPage.tsx`, `pages/CheckoutPage.tsx` — add `className="sf-price"` to existing price elements (no logic change)
- Migration: add `font_preset text` to `theme_configs` table

## Save behavior
On preset click → sets `heading_font`, `body_font`, `font_preset` in local state → existing "Save" button persists to DB → storefront re-renders with full typography applied across every page.

## Out of scope
- Won't change color, button radius, layout, or any non-typographic setting
- Won't touch dashboard typography (dashboard keeps Montserrat Alternates)
- Won't add paid fonts; all 10 are free Google Fonts