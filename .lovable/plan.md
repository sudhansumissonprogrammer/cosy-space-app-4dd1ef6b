# Fix oversized PDP carousel gaps

## What will change
- Disable grid-only off-screen height reservation for product cards inside PDP horizontal carousels.
- Keep the existing product card appearance, carousel order, loading, links, and desktop behavior unchanged.
- Verify on a Serdiya mobile product page that recommendation headings follow the previous card row at normal spacing and no blank bands remain.

## Technical details
- Pass the existing `deferOffscreen={false}` option from `PdpProductCarousel` to `UniversalProductCard`; this option is already documented specifically for horizontal carousels.
- Avoid global CSS changes so product-grid performance optimizations remain active everywhere else.
