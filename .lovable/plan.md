

## Checkout Page Redesign — Shopify-Style Layout

Based on the reference screenshots, the checkout page will be redesigned into a clean, mobile-first, single-column layout with distinct card sections.

### Changes to `src/pages/CheckoutPage.tsx`

**1. Layout restructure — single-column, mobile-first**
- Replace the current 2-column `lg:grid-cols-5` layout with a single-column stacked layout (max-width ~lg on desktop)
- Store name/logo at top with back arrow

**2. Order Summary card (collapsible)**
- Show item count + total price in header, with expand/collapse chevron
- Inside: list items with image, name, qty, prices (show original + sale price with strikethrough)

**3. Coupon Code section**
- Add a coupon input field with "Apply" button
- Query `coupons` table to validate code for the store
- Apply percentage or fixed discount, show savings
- Store has a `coupons` table already with `discount_type`, `discount_value`, `min_order_amount`, etc.

**4. Delivery Details card**
- If saved addresses exist: show the selected address as a summary card with a "Change" button that opens address picker dialog (list all saved + add new)
- If no saved addresses: show inline form (current behavior)
- Email field stays always visible

**5. Payment Method section**
- Show available methods (COD / Razorpay online) as selectable cards with icons
- Keep existing Razorpay integration logic unchanged

**6. Place Order / Pay Now button at bottom**
- Full-width sticky or inline at bottom
- Shows total with any coupon discount applied

### Coupon Logic
- New state: `couponCode`, `appliedCoupon`, `couponDiscount`
- On "Apply": query `coupons` table where `store_id`, `code`, `is_active=true`, validate `min_order_amount`, `expires_at`, `max_uses`
- Calculate discount and show in order summary
- Pass coupon info in order notes or a dedicated field
- Update `used_count` after order placement

### No database changes needed
- `coupons` table already exists with all required fields
- `customer_addresses` table already exists
- Orders table has `notes` field for coupon reference

### Files modified
- `src/pages/CheckoutPage.tsx` — full redesign

