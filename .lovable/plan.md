# Compact checkout-style reviews on product pages

## What will change
- Replace the large review blocks on both product-page versions with the same compact photo-and-rating strip used in checkout.
- Place it directly below the buying controls, where shoppers see it before delivery, trust, and recommendation sections.
- Keep the full review gallery available when the strip is tapped, with featured reviews first and up to 14 reviews on the product page.
- Keep the existing full **View all reviews** destination and review submission access inside the opened review panel.

## Visual cleanup
- Remove the green border, background, thumbnail rings, and green action text.
- Use the storefront’s neutral background, border, foreground, and muted text colors so it follows every store theme.

## Performance and safety
- Reuse the existing shared review query and cache; do not add another request.
- Keep review media lazy-loaded and only mount review cards after the shopper opens the panel.
- Continue deferring the review code so it does not delay the product image, price, or buying controls.
- Leave checkout behavior and review approval rules unchanged.
