# Generate Ring-1 PDP images

## Scope
- Use the current first 10 active products in Serdiyajewellers.shop’s Ring-1 category, ordered exactly as the storefront category order.
- Use each product’s current primary photo as the product reference, with available gallery angles as supporting references.
- Generate one 4:5 premium dark jewellery photograph per product using the supplied exact-preservation prompt.
- Append each result as an extra PDP gallery image; do not replace the current primary image or remove existing gallery media.

## Safety and verification
- Process products individually so one failure does not duplicate or corrupt the others.
- Keep product, store, and category ownership checks from the existing AI Studio flow.
- Record each generation in AI Studio history and attach it once to its matching product.
- Verify all 10 new gallery records, their product pairing, image URLs, and storefront visibility after generation.

## Technical details
- Increase the AI Studio brief allowance so the complete supplied preservation prompt reaches the image model instead of being truncated.
- Use the existing high-quality Gemini image workflow, R2/CDN upload path, and `product_images` PDP gallery records.
- Keep generated images as non-primary extras with the next available display order.
