

## Issues Found

### 1. BestSellingCarousel uses `StorefrontProductCard` instead of `UniversalProductCard`
In Theme 1 (`StorefrontHome.tsx`), when `best_selling_carousel` is enabled, the `BestSellingCarousel` component (line 66-67) renders `StorefrontProductCard` directly -- ignoring the selected `cardStyle`. The non-carousel best-selling grid (lines 134-143) correctly uses `UniversalProductCard`.

### 2. UniversalCategories missing from Themes 2, 3, 4, 6, 7
These themes use their own hardcoded category components (`CategoryPills`, `CategoryIconRow`, `CategoryGrid`, `MagazineCategoryGrid`) and never render `UniversalCategories`, so the `category_style` setting has no effect on them.

### 3. Theme 1 layout conflict with grid category styles
In Theme 1, the section order is: Search → Categories → Hero Image. When `style-3` (square grid) or `style-4` (square grid) is selected, the categories section becomes tall, pushing the hero image far down. The hero should appear before categories for grid-style layouts.

### 4. BestSellingCarousel needs `cardStyle` prop
The carousel component needs to accept and pass `cardStyle` to use `UniversalProductCard` instead of `StorefrontProductCard`.

---

## Plan

### Task 1: Update `BestSellingCarousel` to use `UniversalProductCard`
- Add `cardStyle` prop to `BestSellingCarousel`
- Replace `StorefrontProductCard` with `UniversalProductCard` inside the carousel
- Update `StorefrontHome.tsx` to pass `cardStyle` to `BestSellingCarousel`

### Task 2: Replace hardcoded category components with `UniversalCategories` in Themes 2, 3, 4, 6, 7
For each theme home page:
- **V2** (`StorefrontHomeV2.tsx`): Replace `CategoryPills` call with `UniversalCategories`, add `categoryStyle` from theme config
- **V3** (`StorefrontHomeV3.tsx`): Replace `CategoryIconRow` call with `UniversalCategories`, add `categoryStyle`
- **V4** (`StorefrontHomeV4.tsx`): Replace `CategoryGrid` call with `UniversalCategories`, add `categoryStyle`; also no categories fetched -- add `storeCategories` read
- **V6** (`StorefrontHomeV6.tsx`): Replace `CategoryGrid` call with `UniversalCategories`, add `categoryStyle`
- **V7** (`StorefrontHomeV7.tsx`): Replace `MagazineCategoryGrid` call with `UniversalCategories`, add `categoryStyle`

### Task 3: Fix Theme 1 layout ordering for grid category styles
In `StorefrontHome.tsx`, reorder sections so hero image comes before categories when a grid-style category (`style-3` or `style-4`) is selected. This prevents the tall grid from pushing hero content down.

### Task 4: Ensure font/typography consistency
Section headings in `StorefrontHome.tsx` use hardcoded `fontFamily: "'Alegreya SC', serif"`. These should use `var(--storefront-heading-font)` CSS variable to respect the theme config across all themes.

### Files to modify:
- `src/components/storefront/BestSellingCarousel.tsx` -- accept `cardStyle`, use `UniversalProductCard`
- `src/pages/StorefrontHome.tsx` -- pass `cardStyle` to carousel, reorder hero/categories for grid styles, fix heading font
- `src/pages/StorefrontHomeV2.tsx` -- replace `CategoryPills` with `UniversalCategories`
- `src/pages/StorefrontHomeV3.tsx` -- replace `CategoryIconRow` with `UniversalCategories`
- `src/pages/StorefrontHomeV4.tsx` -- replace `CategoryGrid` with `UniversalCategories`
- `src/pages/StorefrontHomeV6.tsx` -- replace `CategoryGrid` with `UniversalCategories`
- `src/pages/StorefrontHomeV7.tsx` -- replace `MagazineCategoryGrid` with `UniversalCategories`

