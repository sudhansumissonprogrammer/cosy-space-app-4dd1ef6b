

## Plan: Theme-13 Enhancements + QR Code Generator

### 1. QR Code Generator in Store Settings

**File: `src/pages/StoreSettings.tsx`**
- Add a new Card section "QR Code Generator" (visible when store theme is `theme-13`)
- Input field for number of tables (1-50)
- Generates QR codes using the `qrcode` library (or inline SVG QR via a lightweight React component) for each table: `https://{domain}/store/{slug}?table=1`, `?table=2`, etc.
- "Download All" button that generates a printable PDF/image grid of all QR codes with table numbers labeled
- Also generate a "No Table" QR (just the store URL without `?table=`)
- Install `qrcode.react` package for QR rendering

### 2. Add Theme-13 Default Config

**File: `src/pages/StoreThemeSettings.tsx`**
- Add missing `"theme-13"` entry to `DEFAULT_THEME_CONFIGS` with WhatsApp-green defaults (`#25D366`, etc.) and `product_card_style: "style-4"`, `category_style: "style-1"`

### 3. Create Product Card Style 4 (Restaurant Menu Card)

**File: `src/components/storefront/ProductCardStyle4.tsx`** (new)
- A restaurant-optimized product card: horizontal list layout with image left, name + description + price right, and inline +/- quantity buttons
- Includes veg/non-veg diet badge indicator
- Uses WhatsApp-green accent for ADD button
- Reuses the same `Props` interface as other card styles

**File: `src/components/storefront/UniversalProductCard.tsx`**
- Add `case "style-4"` mapping to the new `ProductCardStyle4`

**File: `src/pages/StoreThemeSettings.tsx`**
- Add Style 4 option to the product card style selector UI (label: "Menu List" or "Restaurant")

### 4. Make All Category Styles Work on Theme-13

**File: `src/pages/StorefrontHomeV13.tsx`**
- Import `UniversalCategories` component
- Fetch categories from query cache (`storefront-categories`)
- Read `category_style` from `themeConfig`
- Render `UniversalCategories` above or instead of the current `CategoryTabs` when categories with images exist
- Keep the horizontal text-only `CategoryTabs` as a filter mechanism below the category section

### 5. Make All Product Card Styles Work on Theme-13

**File: `src/pages/StorefrontHomeV13.tsx`**
- Read `product_card_style` from `themeConfig`
- When style is `style-4` (default for theme-13), render the current `MenuItemCard` inline layout
- When style is `style-1`, `style-2`, or `style-3`, render products using `UniversalProductCard` in a grid layout instead of the list layout
- This lets restaurant owners choose between menu-list and grid card views

### 6. Enhanced Search with Filter + Autofill Recommendations

**File: `src/pages/StorefrontHomeV13.tsx`** — Enhance `MenuSearchBar`
- Add a filter icon button inside/beside the search bar
- Tapping filter shows a dropdown/sheet with:
  - **Sort by**: Price low-high, high-low, name A-Z
  - **Diet filter**: All, Veg only, Non-Veg only
- **Autofill suggestions**: As user types, show a dropdown of matching product names below the input (max 5 suggestions), clicking one fills the search and scrolls to that item
- Use `useMemo` to compute suggestions from the products list based on search query

### Summary of Files

| Action | File |
|--------|------|
| Create | `src/components/storefront/ProductCardStyle4.tsx` |
| Edit | `src/pages/StorefrontHomeV13.tsx` (categories, card styles, search enhancements) |
| Edit | `src/pages/StoreThemeSettings.tsx` (theme-13 config, style-4 option) |
| Edit | `src/components/storefront/UniversalProductCard.tsx` (add style-4) |
| Edit | `src/pages/StoreSettings.tsx` (QR code generator card) |
| Install | `qrcode.react` package |

