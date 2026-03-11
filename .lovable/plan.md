

## Expand Color Palettes and Apply Theme to ALL Storefront Components

### Problem
Currently only the marquee header changes when switching color combinations. The `btn-gold` class, navbar, footer, product cards, side cart, checkout buttons, and category labels all use hardcoded gold/black colors. We also only have 3 color combos (Royal Gold, Midnight Rose, Ocean Luxe) — need more luxury options.

### Plan

#### 1. Replace Color Combinations (StoreThemeSettings.tsx)
Remove Midnight Rose and Ocean Luxe. Add 8 curated luxury palettes inspired by the uploaded references:

| Name | Primary | Accent | Background | Text | Marquee Gradient |
|------|---------|--------|------------|------|-----------------|
| Royal Gold (keep) | #b8873c | #000000 | #f7f5f0 | #1a1a1a | gold gradient |
| Crimson Royale | #A71D31 | #3F0D12 | #FBE4E3 | #1a1a1a | rose-red gradient |
| Emerald Luxe | #1C7C54 | #1B512D | #DEF4C6 | #1a1a1a | green gradient |
| Lilac Mist | #663399 | #2E1A47 | #E6C7E6 | #1a1a1a | purple gradient |
| Ocean Teal | #114C5A | #172B36 | #F1F6F4 | #1a1a1a | teal-gold gradient |
| Midnight Navy | #17184B | #001F3F | #F0EEE9 | #1a1a1a | navy-yellow gradient |
| Velvet Merlot | #3F0D12 | #A71D31 | #F1F0CC | #1a1a1a | wine gradient |
| Saffron Bloom | #FFC801 | #114C5A | #F1F6F4 | #1a1a1a | saffron-teal gradient |

#### 2. Make `btn-gold` Dynamic (index.css)
Change `.btn-gold` from hardcoded gold gradient to use CSS variables:
```css
.btn-gold {
  background: linear-gradient(135deg, var(--storefront-primary), var(--storefront-primary-light, ...), var(--storefront-primary));
  color: var(--storefront-bg);
}
```
Add a new CSS var `--storefront-primary-light` (a lighter tint of primary) computed in StorefrontLayout.

#### 3. Update StorefrontLayout.tsx
- Add `--storefront-primary-light` CSS variable (lighten primary by ~20%)
- Apply `background-color: var(--storefront-bg)` and `color: var(--storefront-text)` to the wrapper div
- Apply navbar background using theme accent/bg

#### 4. Update StorefrontFooter.tsx
- Footer background uses `--storefront-accent` or a darker shade
- Text colors use theme variables
- Bottom bar uses theme primary for accent

#### 5. Update StorefrontProductCard.tsx
- All `btn-gold` references already use the class — these will auto-update from CSS change
- Category label and rating colors use theme vars

#### 6. Update StorefrontCategories.tsx
- Replace hardcoded `fontFamily: "'Alegreya SC', serif"` with `var(--storefront-heading-font)`
- Category circle border-hover uses `--storefront-primary`

#### 7. Update SideCart.tsx
- Checkout button uses theme primary color
- Cart count badge uses theme primary

#### 8. Update ProductDetail.tsx
- Buy Now button uses theme primary
- Add to Cart already uses `btn-gold` (auto-fixed)

#### 9. Update StorefrontMarquee.tsx
- Already uses CSS vars — no changes needed

#### 10. Update Preview in StoreThemeSettings.tsx
- Preview section already reflects the selected combo — just needs updated combo list

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/StoreThemeSettings.tsx` | Replace 3 combos with 8 luxury palettes |
| `src/index.css` | Make `btn-gold` use CSS vars, add `--storefront-primary-light` default |
| `src/layouts/StorefrontLayout.tsx` | Add primary-light var, apply bg/text vars to wrapper |
| `src/components/storefront/StorefrontFooter.tsx` | Use theme CSS vars for bg/text |
| `src/components/storefront/StorefrontCategories.tsx` | Use heading font var |
| `src/components/storefront/StorefrontProductCard.tsx` | Theme-aware hover states |
| `src/components/storefront/SideCart.tsx` | Checkout button uses theme primary |
| `src/pages/ProductDetail.tsx` | Buy Now button uses theme vars |
| `src/pages/WishlistPage.tsx` | Add to cart button already uses btn-gold (auto-fixed) |

No database changes needed — same `store_theme_config` columns.

