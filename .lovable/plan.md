# Preserve Product Photo Quality Without Slowing Storefronts

## Goal
Keep homepage and category browsing fast while making newly uploaded product photos sharp on product pages and detailed in full-screen zoom.

## Changes
- Create three image copies for every new product-photo upload:
  - compact card image for homepage and category grids
  - sharp product-page image for the normal gallery
  - high-resolution zoom image that loads only when full-screen viewing begins
- Keep existing photo records compatible so old products continue working without broken images.
- Store and resolve each size predictably, with graceful fallback to the current image when a larger or smaller copy is unavailable.
- Update storefront cards, gallery thumbnails, main product photos, and zoom to request the correct copy.
- Avoid double compression and use high-quality image resampling for jewellery detail.
- Preserve the current upload flow and product editing behavior.

## Safety and Performance
- Do not preload zoom originals.
- Use responsive image choices so mobile browsers download only the needed size.
- Keep the first visible product image prioritized; lazy-load secondary gallery and zoom copies.
- Never overwrite or delete existing photos during rollout.

## Validation
- Upload a detailed test photo and verify all three copies are created.
- Confirm category cards load the small copy, product galleries load the sharp copy, and zoom loads the high-resolution copy.
- Check old products still display correctly.
- Check desktop and mobile storefronts for broken images, unnecessary large downloads, and build/runtime errors.

## Technical Details
- Extend the existing product-photo processor and R2 upload naming convention with card, PDP, and zoom variants.
- Update URL resolution and `srcset` generation for ShopBanao-hosted product images.
- Record the multi-variant product-image policy in the project architecture notes.
