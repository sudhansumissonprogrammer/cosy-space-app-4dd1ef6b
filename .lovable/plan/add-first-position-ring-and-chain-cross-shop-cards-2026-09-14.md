# Add first-position Ring and Chain cross-shop cards

## What will change
- On mobile, place one product-card-sized promotional card as the first tile in Serdiya’s Ring-1 and Chain category grids.
- Ring-1 will show a four-photo Chain collage with a **Shop Chains** button; Chain will show a four-photo Ring collage with **Shop Rings**.
- Tapping anywhere on the card or its button will open the matching category.

## Safety and loading
- Restrict this strictly to `ring-1` and `chain` for the same two Serdiya stores; all other stores, categories, and desktop layouts remain unchanged.
- Keep the card in the first grid position during loading with a matching placeholder, then reveal all four images together to prevent reordering or layout jumps.
- Reuse the existing product image optimization and category navigation paths; do not alter product data, sorting, pagination, analytics product IDs, or cart behavior.

## Verification
- Test both category directions at mobile width, confirm four images, matching card dimensions, first position, full-card navigation, and no console errors.
- Confirm desktop and unrelated categories do not show the promotional card.
