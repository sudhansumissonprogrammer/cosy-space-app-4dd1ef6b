# Festival Sale badge on product cards and PDP photos

## Goal
Reuse the existing compressed transparent Festival Sale badge on discounted products, placing it consistently without restoring the retired merchant-controlled Best Seller feature.

## Changes
- Extend the shared badge component with dedicated card and PDP-overlay sizes.
- Show the badge only when a real sale price is lower than the regular price.
- Add one overlay at the top-left of every product-card image, leaving wishlist, cart, stock, and video controls unobstructed.
- Move the existing PDP price-side badge onto the bottom-left corner of the main product-image area across the standard, V19, V20, and V22 product pages.
- Add a subtle CSS-only glossy shimmer clipped inside the badge; disable it when reduced motion is requested.
- Keep the single existing ~23 KB WebP asset, lazy-load card copies, and avoid extra product queries or per-card state.

## Safety and verification
- Preserve `is_best_selling` collections and do not recreate `award_badge`, dashboard controls, database fields, or badge assignments.
- Verify discounted and full-price products, mobile and desktop placement, control overlap, image loading, and preview errors.
