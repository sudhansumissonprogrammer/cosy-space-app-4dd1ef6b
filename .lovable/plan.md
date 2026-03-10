

## Plan: Add "Best Selling" Feature

### Summary
1. Add an `is_best_selling` boolean column to the `products` table
2. Add a "Best Selling" toggle in the Product Form (create/edit)
3. Update the storefront home page:
   - Remove "Category" from the filter panel (keep Price Range, Availability, add Best Selling filter)
   - Add a "Best Selling" section at the top (below categories, above "Popular Products")

### Database Migration
- Add column: `ALTER TABLE public.products ADD COLUMN is_best_selling boolean NOT NULL DEFAULT false;`

### ProductForm Changes (`src/components/ProductForm.tsx`)
- Add `isBestSelling` state (default `false`)
- Load from existing product on edit
- Add a Switch toggle labeled "Best Selling" next to the existing "Active" toggle
- Include `is_best_selling` in the insert/update payload

### StorefrontHome Changes (`src/pages/StorefrontHome.tsx`)
- **Filter panel**: Remove the Category filter section. Replace with a "Best Selling" pill toggle filter option.
- **Best Selling section**: Add a new section between the categories row and "Popular Products" that shows products where `is_best_selling === true`. Display as a horizontal scrollable row or small grid with a heading like "Best Selling".
- Update `filteredProducts` memo: remove `selectedCategory` logic, add `bestSellingFilter` logic.
- Add state: `bestSellingFilter` (`"all" | "best_selling"`).

### Files to Modify
1. **Database migration** -- add `is_best_selling` column
2. **`src/components/ProductForm.tsx`** -- add best selling toggle
3. **`src/pages/StorefrontHome.tsx`** -- remove category filter, add best selling filter + best selling section

