# Kalinga temporary product visibility

Only store `c3c5dff2-173a-4f4d-90e4-8b1c88c305d9` was changed.

- Membership includes both primary category `Chain with Pendant` and additional assignments to category `ccbe216e-9bc8-4b72-9ee3-3bd8a1cacce2`.
- All 69 matching products are active, including 24 previously inactive products as requested by “all product in chain with pendant”.
- All 131 other products are inactive; 130 were newly hidden and one was already inactive.
- No products were deleted; only `is_active` was updated. Prices, names, media, category links and ordering were not edited.
- Before-change visibility is in `KALINGA-VISIBILITY-BEFORE-2026-10-18.json` (200 products). To restore this exact preceding state, restore each recorded `is_active` value by product ID, scoped to the same store. Do not blindly activate every product.
- The read-only SQL check asserts every target-category member is visible and every nonmember is hidden.
- Live Chain with Pendant page rendered correctly with no browser errors. No orders or payments were submitted.