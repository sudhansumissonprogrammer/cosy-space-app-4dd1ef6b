# Mobile Combo-set category shortcuts

## Scope
- Apply only to the **Combo-set** category for the two requested Serdiya stores: `serdiyajewellers.shop` and `serdiya.com`.
- Show only on mobile; desktop and every other store/category remain unchanged.

## Changes
- Add two compact cards directly below the existing filter row, side by side.
- **Chains:** show four chain product photos in one small collage with a **Shop Chains** action.
- **Rings:** show four Ring-1 product photos in one small collage with a **Shop Rings** action.
- Make the entire card and its action open the corresponding category page.
- Use existing image optimization, storefront paths, theme colors, and accessible labels.

## Loading and safety
- Fetch only eight lightweight preview records for these cards.
- On the targeted mobile Combo-set page, render the shortcut cards first and wait for their images to settle before revealing the normal Combo-set product grid.
- Treat failed/missing images safely so one bad photo cannot leave the page stuck.
- Keep current category caching, filtering, pagination, analytics, and desktop behavior intact.

## Verification
- Check both requested stores at a 360px mobile viewport.
- Confirm placement under the filter, compact sizing, four images per card, correct Chain/Ring navigation, shortcut-first loading, and no console/runtime errors.
- Confirm another category and desktop view do not show the cards.
