# Restrict supplier details in product editing

## Scope
- Show the supplier link, supplier stock warning, and supplier fields only for Utkal Watch, HopKnock, and CarryBazaar1.
- Hide them from every other store in both full-page and in-panel product editing.
- Preserve existing hidden supplier data when another store edits and saves a product.

## Technical details
- Gate the existing supplier section by immutable store IDs, with the three requested slugs as fallback.
- Keep all product pricing, stock, media, categories, and other editing behavior unchanged.
- Verify the project build after the change.
