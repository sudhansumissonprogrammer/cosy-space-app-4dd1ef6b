# ROAS Optimization Feature Bundle — Implementation Plan

This plan covers 7 high-impact features to maximize Meta ad ROAS for store owners. Each feature directly reduces checkout friction, increases AOV, or improves attribution.

---

## 1. Express Checkout for Returning Customers

**Current state:** Checkout already pre-fills from `localStorage` and saved `customer_addresses`. But the full form still renders — returning users see the same multi-step page as first-timers.

**Change:** Add an "Express Mode" detection at the top of `CheckoutPage.tsx`. When a returning customer has a saved address (logged-in with addresses OR localStorage data) AND COD is available, render a compact single-screen:

- Summary card with address preview (1 line)
  &nbsp;
- Single "Place Order" button
- "Edit details" link to expand the full form

**Files:** `src/pages/CheckoutPage.tsx`

---

## 2. Post-Purchase Upsell Page

**Current state:** After order placement, `CheckoutPage.tsx` shows a simple "Order Placed!" confirmation with links to account and store.

**Change:**

- Create `src/components/storefront/PostPurchaseUpsell.tsx` — fetches 2-3 related products (same category or best-sellers, excluding items just ordered)
- Modify the `orderPlaced` section in `CheckoutPage.tsx` to show upsell offers BEFORE the thank-you message
- "Add to Order" button calls `place-order` edge function to append an `order_item` to the existing order and update the order total
- "No thanks" dismisses to the standard confirmation
- Track via CAPI as a secondary Purchase event

**Files:** `src/components/storefront/PostPurchaseUpsell.tsx` (new), `src/pages/CheckoutPage.tsx`, `supabase/functions/place-order/index.ts` (add upsell item append logic)

**Database:** Add an `add-to-order` edge function or extend `place-order` to support appending items to existing orders.

---

## 3. Exit-Intent Popup with Coupon

**Current state:** `coupons` table exists with full validation. No exit-intent detection.

**Change:**

- Create `src/components/storefront/ExitIntentPopup.tsx`
- Detects `mouseleave` on `document` (desktop) and scroll-up pattern (mobile)
- Fetches the first active coupon for the store, displays it in a modal
- Shows only once per session (`sessionStorage` flag)
- Tracks `fbclid` from URL params so the coupon usage can be attributed to a specific ad
- Fires a custom CAPI event (`Lead`) when coupon is copied

**Files:** `src/components/storefront/ExitIntentPopup.tsx` (new), integrate into storefront layouts

---

## 4. Trust Badges Near Buy Button

**Current state:** Product page already has "Guaranteed Safe Checkout" with payment logos and delivery/trust badges below the CTA. These are solid but positioned after the buy buttons.

**Change:**

- Add a compact inline trust strip ABOVE the CTA buttons: "🔒 Secure | 🚚 Free Delivery | ↩ Easy Returns" as small badges
- Move the payment logos closer to the buy button area
- This is a small UI tweak in `ProductDetail.tsx`

**Files:** `src/pages/ProductDetail.tsx`

---

## 5. Smart Product Recommendations (Co-occurrence Based)

**Current state:** "Frequently Bought Together" and "Related Products" exist but use random/category-based selection, not actual order data.

**Change:**

- Create a database function `get_co_purchased_products(product_id, limit)` that queries `order_items` to find products frequently ordered together
- Falls back to category-based if insufficient co-occurrence data
- Replace the current random selection in `FrequentlyBoughtTogether` and `RelatedProducts` components

**Database migration:** New RPC function querying `order_items` for co-occurrence.

**Files:** `src/pages/ProductDetail.tsx` (update query in `FrequentlyBoughtTogether`)

---

## 6. Store Speed Dashboard

**Current state:** `optimizeImageUrl()` exists in `src/lib/imageOptimize.ts`. No UI surfaces performance data.

**Change:**

- Add a "Store Health" tab/section in `src/pages/StoreAnalytics.tsx`
- Show: total products, products missing images, products with oversized image URLs (no optimization params), estimated page weight
- Actionable items: "X products have no image", "Y products use unoptimized images"
- Query products table for `image_url IS NULL` counts and URL pattern analysis

**Files:** `src/pages/StoreAnalytics.tsx`

---

## 7. Enhanced CAPI Matching

**Current state:** `meta-capi` edge function sends hashed email, phone, and external_id. Checkout has `fullName`, `city`, `state`, `pincode` but doesn't pass them.

**Change:**

- Update `fireMetaCAPI` in `src/lib/metaCapi.ts` to accept `firstName`, `lastName`, `city`, `state`, `zipCode` params
- Update `meta-capi` edge function to hash and include `fn` (first name), `ln` (last name), `ct` (city), `st` (state), `zp` (zip) in `user_data`
- Update the Purchase event call in `CheckoutPage.tsx` to pass these fields from the checkout form
- This alone can improve Meta's Event Match Quality score by 15-25%

**Files:** `src/lib/metaCapi.ts`, `supabase/functions/meta-capi/index.ts`, `src/pages/CheckoutPage.tsx`

---

## Implementation Order (by ROAS impact)

1. **Enhanced CAPI Matching** — fastest to build, immediate attribution improvement
2. **Express Checkout** — reduces drop-off for repeat buyers
3. **Post-Purchase Upsell** — direct AOV increase
4. **Exit-Intent Popup** — recovers 5-10% of abandoning visitors
5. **Smart Recommendations** — increases cart size
6. **Trust Badges** — small UI tweak
7. **Speed Dashboard** — long-term optimization tool