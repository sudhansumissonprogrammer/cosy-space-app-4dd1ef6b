# Add enhanced PDP photos to eight Chain with Pendant products

## Scope
- Use the current first eight active products in Imitation World’s **Chain with Pendant** category, in the exact storefront order.
- Use only each product’s current first PDP slide as the image reference.
- Generate one high-quality Gemini image per product with the supplied strict-preservation prompt.
- Save each result as high-quality WebP on ShopBanao’s image server and append it as the final PDP gallery image; keep every current primary and gallery image unchanged.

## Safety and verification
- Process products one at a time and stop on any credit, access, or model error rather than retrying incorrectly.
- Record every result in AI Studio history and attach it only once to the matching product.
- Verify all eight source/result pairings, final gallery positions, WebP delivery, and storefront visibility.

## Technical details
- Add a source-only option to the existing AI Studio flow so no secondary gallery angle is sent when this strict prompt is used.
- Keep the existing Gemini high-quality workflow, 94-quality WebP conversion, R2/CDN storage, ownership checks, daily credit limit, and cache purge.
