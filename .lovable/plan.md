# CheckoutV2 parity fixes

After a deep diff against `src/pages/CheckoutPage.tsx` (the old, battle-tested checkout), CheckoutV2 is missing several revenue-critical and reliability pieces. It currently only computes `subtotal` and forwards a very thin `place-order` body. This causes:

- **Undercharging** — no shipping, no tax, no coupons applied on the charged amount.
- **Broken attribution & tracking** — no Pixel Purchase, no GA4 purchase, no storefront funnel event, no Meta CAPI signals (fbc/fbp/event_id/event_source_url), no visitor/session/UTM snapshot.
- **Broken abandoned-cart recovery** — `abandoned_cart_id` is never passed to `place-order`, so recovered orders aren't marked.
- **Broken account flow** — no `create-guest-account` call, no save-address-to-account, no `order-placed` event, no auto-applied coupon from `?coupon=` / `pending_coupon` storage.
- **No order notifications** — `notify-order` (owner email + PWA push + customer email) never fires.
- **Wrong partial advance** — advance math ignores shipping/tax/coupon.

## What changes (single file: `src/pages/CheckoutV2Page.tsx`)

### 1. Totals engine — mirror old checkout exactly
- Fetch `store_shipping_config` + `store_tax_config` (React Query, same keys as CheckoutPage so cache is shared).
- Compute `shippingCharge`, `taxAmount`, `couponDiscount`, and `total = subtotal + tax + shipping − discount`.
- Rewrite `partialAdvanceTotal` to spread tax/shipping proportionally and subtract coupon share (same formula as `CheckoutPage.tsx` lines 683–695).
- Order Summary panel: show line items for Shipping, Tax, Discount when non-zero.
- CTA + waiting screen amounts use the correct `chargeAmount`.

### 2. Coupon auto-apply (no new UI)
- On mount, read `?coupon=` from URL, else `sessionStorage.pending_coupon` / `localStorage.pending_coupon` (WhatsApp recovery flow).
- Call `validate_store_coupon` RPC once, apply if valid; silent-fail otherwise.
- Clean up on successful order.

### 3. Rich `place-order` body
Extend the current body with the fields the old checkout sends:
- `coupon_id`, `abandoned_cart_id`
- `meta: { event_id, fbc, fbp, event_source_url }` (sanitized, preview-safe)
- `visitor_id`, `session_id`, `attribution` (UTM + landing + referrer)
- Persist `abandoned_cart_id` from URL or an `abandoned_cart_id_<storeId>` localStorage key just like the old code.

### 4. Success-side plumbing (new `onOrderSuccess(orderId)` helper)
Fires exactly once per order (Set-based idempotency):
- Fire Pixel Purchase (sessionStorage dedupe key `meta_purchase_fired_<orderId>` — same as old).
- Fire GA4 `purchase`.
- Fire storefront funnel `purchase` event.
- Dispatch `window` event `order-placed`.
- Call `notify-order` (owner + customer email + owner push).
- If no logged-in customer, call `create-guest-account` and hydrate session via `supabaseStorefront`.
- If logged in, call `saveAddressToAccount` (same helper pattern as old file).
- Clear cart, clear pending coupon storage, clear `checkout_phone`.

`onOrderSuccess` is invoked from every success path: UPI polling, manual "I've paid" recheck, COD, and QR-scan success.

### 5. Correct `payment_method` on order
- Send `payment_method: "razorpay"` today is a placeholder → change to the actual gateway once `create-upi-intent` returns `pg`, via a follow-up `orders.update({ payment_method })` in the client (RLS-safe: `place-order` already exposes a small `update-order-gateway` path or we piggy-back on the existing `checkout-v2-cod`-style pattern). If none is safe, we leave as-is (cosmetic).

### 6. Safety guards kept
- Single `create-upi-intent` call (already fixed).
- Live PSP verify each poll tick + focus/visibility instant recheck (already fixed).
- Cross-check that `create-upi-intent` uses `chargeAmount` from the DB order row (it already reads `dbOrder.total` + `advance_paid`, which is set by `place-order` from the enriched body), so shipping/tax/coupon flow to the gateway automatically.

## Files touched
- `src/pages/CheckoutV2Page.tsx` — all of the above.

No DB migrations, no edge function changes. All backend endpoints already exist and already accept these fields (they're what the old CheckoutPage sends today).

## Out of scope (explicitly deferred)
- Coupon **entry UI** (input box + apply button). Auto-apply from URL/storage is included so WhatsApp recovery works; the visible input can be a follow-up if you want it.
- Rewriting the address form / theme.
