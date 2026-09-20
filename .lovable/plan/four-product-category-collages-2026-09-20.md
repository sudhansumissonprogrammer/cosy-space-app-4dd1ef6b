# Four-product category collages

## Goal
Replace each single homepage category image with a four-product photo collage inside the same existing circle, square, or card dimensions. Give store owners control over the four products shown, while keeping automatic choices when they have not configured them.

## What will change
- Add four ordered featured-product slots to each category. Selections are restricted to active, visible products belonging to that store and category.
- Automatically choose up to four eligible products for existing and unconfigured categories. The choice will be stable rather than changing on every visit, preventing flicker and preserving cache efficiency.
- Add a clear “Category display photos” control to the existing category edit screen. Owners can search their category products, choose up to four, reorder or remove them, preview the final 2×2 collage, and return to automatic selection.
- Render the four photos as a 2×2 collage inside the current category image boundary across every homepage theme, including the dedicated category grids in Themes 19 and 20. The category tile dimensions and navigation behavior will not change.
- Preserve sensible fallback behavior: use available selected/automatic product photos, then the existing category image for any empty slots, then the current placeholder when no image exists.

## Performance safeguards
- Resolve all category collage URLs in the existing storefront shell response with one database operation; never make one request per category.
- Return only four small image URLs per category and no product descriptions, prices, or other unnecessary product data.
- Keep the existing category image as the immediate first paint, then lazy-load collage thumbnails with asynchronous decoding. Off-screen category tiles will not request images until near the viewport.
- Request thumbnail-appropriate image widths and preserve fixed dimensions to prevent layout movement.
- Purge the store’s cached shell after an owner saves a selection so shoppers receive the update without adding repeat storefront requests.

## Technical details
- Add a category-to-featured-product table with `category_id`, `product_id`, and ordered position 1–4. Use foreign keys, uniqueness constraints, indexes, explicit grants, RLS, and store-owner/admin policies.
- Add owner-scoped save/read operations that validate same-store ownership, category membership, active visibility, no duplicate products, and at most four positions.
- Update `get_storefront_shell` using the required drop-first function migration pattern. Build each category’s resolved `collage_image_urls` in one lateral/aggregate query, preferring valid owner selections and filling remaining positions from deterministic active products.
- Keep existing direct category queries compatible by selecting the configured collage relationship through the shared operation or falling back to `image_url` until the shell cache is seeded.
- Create one shared category collage renderer and use it from all category styles instead of maintaining duplicated image logic.
- Do not change category-page product behavior, product ordering, category visibility rules, or the current category image uploader.

## Validation
- Verify automatic fallback and owner-selected order for categories containing 0, 1, 2, 3, and 4+ eligible products.
- Verify another store cannot select or expose products from a different store or category.
- Verify deleted, inactive, moved, or hidden products safely fall out and are replaced automatically.
- Check all storefront themes on mobile and desktop for unchanged tile sizes, clipping, labels, navigation, and no layout shift.
- Compare first-load network behavior before and after: one storefront data request, no category-by-category queries, lazy off-screen thumbnails, and no console/runtime/build errors.
