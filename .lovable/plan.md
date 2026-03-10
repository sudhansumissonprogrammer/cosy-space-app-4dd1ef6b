## 2. Related Products on Product Detail Page

**What:** "You May Also Like" section at the bottom of `ProductDetail` showing 4 products from the same store, prioritizing same category.

**How:**

- Query products from same `store_id` where `id != current product`, `is_active = true`, limit 4, ordered by same category first
- Add a horizontal scrollable grid of `StorefrontProductCard` components below the product details
- Reuse the existing `StorefrontProductCard` component

**Files:** `src/pages/ProductDetail.tsx`

---

## 3. Product Search with Autocomplete

**What:** As users type in the search bar, show a dropdown with matching product suggestions (name + image + price) that link directly to product pages.

**How:**

- Create a new `StorefrontSearchBar` component replacing the current Input in `StorefrontHome.tsx`
- Use the already-fetched `products` data to filter client-side (no extra DB calls)
- Show a popover/dropdown below the search input with up to 6 matching results
- Each result shows thumbnail, name, price, and links to the product detail page
- Close dropdown on selection or blur

**Files:** New `src/components/storefront/StorefrontSearchBar.tsx`, update `src/pages/StorefrontHome.tsx`

---

## 4. Progressive Web App (PWA)

**What:** Make the storefront installable on mobile with "Add to Home Screen" support.

**How:**

- Install `vite-plugin-pwa` package
- Configure in `vite.config.ts` with manifest (name, icons, theme color, start_url)
- Add `navigateFallbackDenylist: [/^\/~oauth/]` to workbox config
- Create PWA icons (192x192, 512x512) in `/public`
- Add mobile meta tags to `index.html` (theme-color, apple-touch-icon, viewport)
- The manifest will use the app name "Storivo" with appropriate colors

**Files:** `vite.config.ts`, `index.html`, new icon files in `public/`

---

## Summary of Changes


| Feature             | Files Modified                 | New Files                 |
| ------------------- | ------------------------------ | ------------------------- |
| Sort options        | `StorefrontHome.tsx`           | —                         |
| Related products    | `ProductDetail.tsx`            | —                         |
| Search autocomplete | `StorefrontHome.tsx`           | `StorefrontSearchBar.tsx` |
| PWA                 | `vite.config.ts`, `index.html` | PWA icons                 |


No database changes needed. All features are frontend-only using existing data.