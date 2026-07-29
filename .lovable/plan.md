
# GoKwik-style Side Cart Rebuild

Rebuild `SideCart.tsx` (the slide-in cart drawer) to match the reference layout, with zero impact on storefront cold-load (everything stays inside the already-lazy `SideCart` chunk, and all data fetching stays gated on `isCartOpen`).

## 1. Layout (top → bottom)

```text
┌──────────────────────────────────────────┐
│ Cart (2)                             [X] │  ← slim header, py-2
├──────────────────────────────────────────┤
│ ▸ YOUR ITEMS  (horizontal carousel)      │  ← cart items as cards + arrows
│ ┌──────┐ ┌──────┐ ┌──────┐               │
│ │ img  │ │ img  │ │ img  │  → arrows     │
│ │title │ │title │ │title │               │
│ │₹ qty │ │₹ qty │ │₹ qty │               │
│ └──────┘ └──────┘ └──────┘               │
├──────────────────────────────────────────┤
│ [STEAL DEALS] Complete your set          │  ← lime pill + heading
│ FLAT ₹100 OFF strip                      │
│ ◂ product carousel 1 (full height) ▸     │
│ ◂ product carousel 2 (full height) ▸     │
│ ◂ carousel 3 (peeking ~20% height)       │
├──────────────────────────────────────────┤
│      ₹680 Saved so far!   (green pill)   │
│ 🧾 Estimated Total    ₹1,779  ₹1,099     │
│                          (38% OFF)       │
│ ┌──────────────────────────────────────┐ │
│ │            Checkout                  │ │
│ │ Get Extra ₹50 Discount on UPI 🅿🟣🅶 │ │
│ └──────────────────────────────────────┘ │
│        Powered by [shopbanao logo]       │
└──────────────────────────────────────────┘
```

## 2. Cart items → horizontal carousel

- Replace the vertical stacked list with an Embla carousel (same `@/components/ui/carousel` used by the PDP), `basis-[42%] sm:basis-1/3`, with prev/next arrows shown when >1 item.
- Card contents: image with remove (X) on the corner, title (1 line), price, and a compact qty stepper (36px, not the current 44px blocks) instead of the tall up/down row.
- Single item = single card, no arrows.

## 3. Three smart upsell carousels (same engine as PDP)

- New hook `useCartCarouselPools.ts`, adapted from `usePdpCarouselPools.ts`:
  - inputs: `storeId`, all cart `productIds`, and the categories of the products currently in the cart
  - pool 1: **same category as cart products** (union of cart categories)
  - pool 2: **Best sellers**
  - pool 3: **You may also like** (next merchant category)
  - Dedupe priority same → best → other, and always exclude everything already in the cart. Infinite `useInfiniteQuery` paging like PDP.
  - `enabled: isCartOpen` so no network work happens until the drawer opens (protects home/category cold load).
- New `CartProductCarousel.tsx` — a compact variant of `PdpProductCarousel`:
  - **review badge moved onto the product image** (top-left overlay pill)
  - **price rendered inline next to the title** (title left, price right) so the card is shorter
  - reduced card height so carousel 1 and 2 are fully visible and carousel 3 peeks ~20%
  - red highlight on title+price for products in the discount strip
- Existing `UpsellStrip` (merchant-configured offers) stays and renders above the three carousels when offers match.

## 4. Steal deals + ₹100 flat off

- Lime "STEAL DEALS" pill (skewed black-shadow tag, as in the reference) + "Complete your set" heading above the carousels.
- A `FLAT ₹100 OFF` strip applied to the first carousel row; those cards show title + price in red (`text-red-600`) with the struck MRP.
- The ₹100 value is read from the store's auto-apply coupon (`get_store_auto_apply_coupon`) so it follows whatever the merchant configures, falling back to hidden if no flat coupon exists.

## 5. Footer: savings, estimated total, checkout

- **"₹X Saved so far!"** green pill centred and overlapping the footer edge — X = (sum of MRP − sale price across cart) + auto-apply coupon discount.
- **Estimated Total** row: receipt icon, struck MRP total, bold final total, and `(N% OFF)` in green underneath.
- **Checkout button** (full-width green, radius from theme token): main label `Checkout`, sub-label `Get Extra ₹{couponValue} Discount on UPI` followed by the existing UPI app icons already used in Buy Now (`/icons/phonepe-round.webp`, `paytm-round.webp`, `gpay-round.webp`). Coupon value comes from the same auto-apply/WA coupon resolver used by `AutoCouponHint`.
- Free-shipping progress bar stays but compacted to one line.
- Remove the separate "Continue Shopping" text button under checkout (kept only in the empty-cart state) and tighten all footer paddings.
- **Powered by** line with the existing `src/assets/shopbanao-logo.webp` at 14px height.

## 6. Space tightening

- Sheet header `py-4 → py-2`, item area padding `px-4 py-3 → px-3 py-2`, footer `space-y-1.5 → space-y-1`, section gaps reduced. Net ~90px reclaimed so more carousel is visible on a 640px viewport.

## 7. Auto-open cart after add-to-cart

- Add a `cart:fly-landed` listener (event already dispatched by `src/lib/flyToCart.ts`, currently unhandled) inside `CartContext` / `SideCart` that calls `openCart()` — so the drawer opens right after the fly-to-cart animation lands, from every product card and PDP add.
- Explicitly **not** on Buy Now (that goes straight to checkout).

## Performance guarantees

- All new components live under the existing `lazy()`-loaded `SideCart` chunk — no new bytes on home/category first paint.
- All new queries carry `enabled: isCartOpen`, `staleTime: 5min`, so cold storefront and category loads issue zero extra requests.
- Cart-item images reuse already-cached URLs; carousel images lazy-load.

## Technical notes

- Files added: `src/hooks/useCartCarouselPools.ts`, `src/components/storefront/cart/CartItemsCarousel.tsx`, `src/components/storefront/cart/CartProductCarousel.tsx`, `src/components/storefront/cart/CartStealDealsHeader.tsx`, `src/components/storefront/cart/CartTotalsFooter.tsx`.
- Files changed: `src/components/storefront/SideCart.tsx` (composition), `src/contexts/CartContext.tsx` (fly-landed auto-open).
- Colors go through storefront CSS vars (`--storefront-primary`, `--storefront-text`, `--storefront-bg`) except the intentional steal-deal lime/red/green accents, which will be added as scoped tokens.
