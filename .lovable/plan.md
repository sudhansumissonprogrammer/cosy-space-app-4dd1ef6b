## Goal
Swiggy-style "fly product into cart" animation on every Add-to-Cart, then SideCart slides in once the arc lands. Works across all 21 themes.

## Current state
- `src/lib/flyToCart.ts` exists but renders a tiny "+1" bubble with a linear transition — not the rich product-image arc Swiggy uses.
- Only **V19 / V20** product cards call it. PDP, Style1/3/4 cards, QuickView, VariantPicker, FBT, V19/V20 PDP do not.
- `data-cart-target` anchor exists only on V19/V20 headers. Other themes have no target, so the bubble would have nowhere to land.
- `addToCart` in `CartContext` opens SideCart **immediately**, colliding with any pre-open animation.

## Plan

### 1. Rewrite `src/lib/flyToCart.ts` (Swiggy-grade)
- New signature: `flyToCart(source, { imageUrl?, label?, productName? })`.
- Render a **circular product thumbnail** (40px, white ring + soft drop-shadow) when `imageUrl` given; fall back to "+1" bubble.
- Replace linear translate with a **parabolic arc** via WAAPI (`element.animate`) using 3 keyframes:
  - 0%: at source, scale 0.9, opacity 0 → 1 (60ms pop-in)
  - 45%: lifted (midpoint Y minus ~120px), scale 1.1, slight rotate 8°
  - 100%: at cart icon, scale 0.25, rotate -6°, opacity 0.4
  - Easing `cubic-bezier(.5,-0.2,.2,1)` (overshoot top, gravity drop)
  - Duration 720ms total
- Add a faint **motion-trail dot** that follows 80ms behind for "tail" feel.
- On completion: pulse target with existing `cart-target-absorb` class + dispatch `cart:fly-landed` CustomEvent.
- Honor `prefers-reduced-motion` (skip animation, just bump cart).

### 2. New helper `src/lib/addToCartAnimated.ts`
Single entry point used everywhere:
```ts
addToCartAnimated({ item, source, imageUrl, addToCart, openCart })
```
- Calls `addToCart(item, { silent: true })` so the side drawer stays closed.
- Runs `flyToCart` with the product image.
- After ~720ms (or on `cart:fly-landed`), calls `openCart()` so the drawer slides in **after** the arc lands.
- If reduced-motion: opens cart immediately.

### 3. Add `data-cart-target` everywhere
Cart icon must exist as a landing pad in every theme:
- `DesktopNavBar.tsx` (header cart button — used by V1, V2, V10–V18)
- `MobileBottomNav.tsx`, `MobileBottomNavModern.tsx`, `MobileBottomNavV15.tsx`, `MobileBottomNavV17.tsx` (now show Cart icon)
- `V17CartBadge.tsx`
- Storefront layouts that render their own header cart (audit V3, V11, V13, V18, V21 layouts).
- The selector picks the **topmost on desktop / bottommost on mobile** automatically, so adding both header + bottom-nav is safe.

### 4. Wire the helper into every Add-to-Cart call site
Replace the current raw `addToCart(...)` + auto-open in each:
- `src/pages/ProductDetail.tsx` (sticky bar Add-to-Cart)
- `src/pages/V19ProductDetail.tsx`, `src/pages/V20ProductDetail.tsx`
- `src/components/storefront/ProductCardStyle1.tsx` (most-used)
- `src/components/storefront/ProductCardStyle3.tsx`, `ProductCardStyle4.tsx`
- `src/components/storefront/QuickViewModal.tsx`
- `src/components/storefront/VariantPickerDialog.tsx`
- `src/components/storefront/pdp/FrequentlyBoughtTogether.tsx`
- `src/components/storefront/v19/V19ProductCard.tsx`, `v20/V20ProductCard.tsx` (already animated — switch to new helper for consistency + post-arc cart open)
- `src/components/storefront/CartUpsell.tsx` (already inside cart — keep silent, no fly)
- `src/components/CreateOrderDialog.tsx` (admin only — leave untouched)

Each call gets `source = e.currentTarget` and `imageUrl = product.image_url` (or selected variant image).

### 5. Visual polish
- Cart-target absorb pulse: existing V19/V20 CSS lifted into a shared global rule in `src/index.css` so every theme gets the bump (uses `--storefront-primary`).
- Tiny haptic on mobile (`navigator.vibrate?.(8)`) when arc lands.

### Out of scope
- Wishlist heart animation, price count-up, bottom-nav pill morph (deferred from earlier audit).
- Theme-specific button micro-interactions.

## Files touched (≈14)
- `src/lib/flyToCart.ts` (rewrite)
- `src/lib/addToCartAnimated.ts` (new)
- `src/index.css` (shared absorb keyframes)
- `src/contexts/CartContext.tsx` (no API change; helper passes `silent`)
- ~10 product card / PDP / dialog files (swap to helper, add `data-cart-target` where needed)

## Risk
Very low — pure presentation layer, no business logic. WAAPI is supported in every modern browser; reduced-motion users get instant cart open.