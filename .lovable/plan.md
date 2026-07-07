
# V2 Checkout — Full Feature Parity with Old Checkout

Goal: bring `CheckoutV2Page.tsx` to full parity with `CheckoutPage.tsx` so any store can switch to V2 with zero regressions in payments, Meta Ads attribution, analytics, and UX. All work happens inside V2 — old checkout is left untouched as a fallback.

## Scope

- 11 blockers + 15 important regressions from the gap report
- No changes to edge functions themselves (they already work, V2 just needs to call them)
- No changes to the DB schema
- No changes to `CheckoutPage.tsx` (old stays as safety net until user removes it)

---

## Phase 1 — Payment Gateways (blocker)

1. **Fetch `get_store_payment_config` on mount**
   - New React Query: `["payment-config", store.id]` calling the same RPC as old checkout
   - Show skeleton while loading, "no payment methods configured" if empty
   - Derive `hasCod / hasRazorpay / hasCashfree / hasPayu` flags
   - Honor these flags everywhere: hide COD tile if disabled, only show online tiles for enabled gateways

2. **Prewarm edge functions on mount** (`place-order`, `razorpay-order`, `store-cashfree-create-order/verify/status`, `payu-create-txn/verify/status`) — copy `prewarmEdgeFunction()` calls from old.

3. **Razorpay modal path**
   - Port `loadRazorpayScript()` + `openRazorpayForOrder()` from old
   - Call `razorpay-order` → open Razorpay modal → on success call `razorpay-verify` → run existing `finishSuccess()`
   - Handle modal-dismiss (`ondismiss`) → set `paymentFailed + pendingOrder`

4. **Cashfree drop-in path**
   - Port `loadCashfree()` + `openCashfreeForOrder()`
   - Call `store-cashfree-create-order` → open drop-in → poll `store-cashfree-status` on return
   - Handle Cashfree redirect-back (`?cf_order=` param) recovery on mount, mirroring PayU recovery already in V2

5. **PayU Bolt path**
   - Keep existing V2 PayU redirect-back recovery
   - Add `openPayuForOrder()` calling `payu-create-txn`, opening Bolt/hosted checkout, verifying via `payu-verify-payment`

6. **`checkout_token` idempotency**
   - Generate one UUID per checkout session (ref, reused across retries)
   - Pass in every `place-order` call so server dedupes double-tap orders

7. **`confirmingPayment` full-screen overlay** during gateway verification polling (Razorpay/Cashfree/PayU verify).

8. **`paymentFailed + pendingOrder` retry banner** — if order was created but the gateway leg failed/cancelled, show retry button that re-opens the same gateway modal (no new order row).

---

## Phase 2 — Cart/Order Correctness (blocker)

9. **Buy-Now single-product mode** (`?product=&variant=&qty=`)
   - Detect params on mount → fetch product+variant → build a one-off `checkoutItems` array instead of using cart
   - Skip `clearCart()` in buy-now mode
   - `CheckoutSkeleton` while product loads

10. **`variantId` in items payload** — include `variantId` for every line item sent to `place-order` (both cart mode and buy-now).

11. **`customer_email` in `place-order`** order object — currently only sent to UPI intent.

---

## Phase 3 — Coupons & Address Book (blocker)

12. **Coupon UI**
    - Check `store_has_active_coupons` RPC → only render section if true
    - Collapsible input with Apply/Remove buttons
    - Call `validate_store_coupon` RPC → show discount / error inline
    - Keep existing auto-apply from URL/storage but expose Remove
    - Show strikethrough + discount line in order summary (already partially there)

13. **Saved address book (logged-in customers)**
    - Fetch `customer_addresses` for `storefront_customers.id`
    - Auto-select default; render selected card with "Change" button
    - Change → dialog with list + radio + "Add New Address" form (label, name, phone, street, city, state, pincode; first save sets `is_default = true`)
    - On order success call existing `saveAddressToAccount()` path

14. **Returning-guest 1-tap pre-fill** — lookup last `orders` row by phone for guests, pre-fill address fields with an "Is this you?" chip.

---

## Phase 4 — Meta/Analytics Parity (blocker + important)

15. **`fireInitiateCheckoutOnce()`** — FB Pixel `InitiateCheckout` + Meta CAPI + GA4 `begin_checkout`, fired on real payment intent (Pay button click), deduped per session.

16. **`fireAddPaymentInfoOnce()`** — FB Pixel `AddPaymentInfo` + Meta CAPI, fired when user picks a payment method, deduped per session.

17. **`begin_checkout` storefront event** on mount.

18. **`setCapiUser()`** — debounced Advanced Matching enrichment as user types name/email/phone/city/state/pincode.

19. **`pay_click` + `checkout_field_error` + `payment_failed` storefront events** — mirror old event calls.

20. **FB Pixel `Lead`** on valid email blur (nice-to-have but cheap).

---

## Phase 5 — UX Regressions (important)

21. **`ensureCustomer()` on mount** — lazily create `storefront_customers` row for logged-in shoppers.

22. **Auto-fill email from logged-in `customer.email`**.

23. **WA consent checkbox** (`waConsent` state) → propagate to `capture_checkout_lead` `p_consent` param (currently hardcoded `true`).

24. **`saveExpressInfo()`** — persist form to `express_checkout_{storeId}` localStorage after success (V2 already reads it on mount).

25. **Zippopotam.us fallback** for pincode lookup + spinner indicator during resolve.

26. **Geolocation "Use my location" button** → `reverse-geocode` edge function.

27. **Hindi bilingual labels** — port `isHindi` flag + bilingual strings for stores using Hindi themes.

28. **Partial-payment breakdown on thank-you screen** — show advance paid / balance on delivery box when `payment_type = "partial"`.

29. **`PostPurchaseUpsell` component** — lazy-mount on success screen (same component old uses).

---

## Order of Implementation

The plan is grouped so each phase can ship independently and be tested end-to-end before the next:

1. Phase 1 (payments) — highest risk, biggest win
2. Phase 2 (buy-now + variantId + email)
3. Phase 3 (coupons + address book)
4. Phase 4 (Meta/analytics parity)
5. Phase 5 (UX regressions + upsell)

After Phase 4, ads and payments are safe — old checkout can be removed.
After Phase 5, V2 is a strict superset of old checkout.

---

## Files Touched

- `src/pages/CheckoutV2Page.tsx` — main file (all phases)
- Reuse existing helpers already imported by old checkout:
  - `src/lib/payments/razorpay.ts`, `cashfree.ts`, `payu.ts` (loader + open helpers)
  - `src/lib/analytics/fbPixel.ts`, `ga4.ts`, `metaCapi.ts`, `storefrontEvents.ts`
  - `src/lib/checkout/*` (validation, address save, guest account, pincode lookup)
  - `src/components/checkout/PostPurchaseUpsell.tsx`, `CheckoutSkeleton.tsx`, address-book dialog
- No new edge functions, no new DB tables, no schema migrations

---

## Verification Plan

For each phase, run through in preview on `imitationworld` (UPI) + a Razorpay/Cashfree/PayU test store:

- Place order via each enabled gateway → confirm order row + `order_items` (with variantId) + payment_status = paid
- Double-tap Pay → confirm only one order row created (checkout_token dedupe)
- Apply/remove coupon → confirm discount math + `orders.discount_amount`
- Logged-in: pick saved address → confirm shipping_address JSON matches
- Buy-now URL from PDP → confirm single-item order, cart untouched
- Meta Events Manager: confirm `InitiateCheckout`, `AddPaymentInfo`, `Purchase` all fire with matching `event_id` (browser + CAPI dedupe)
- Cancel/fail a gateway → confirm retry banner appears and can re-pay same order

---

## Non-Goals (out of scope for this plan)

- Removing/deleting `CheckoutPage.tsx` — user will flip the `checkout_v2_enabled` flag store-by-store after they've validated V2 in production
- Nice-to-have items (trust strip, collapsible summary with images, ShopBanao footer, delivery-estimate inline text) — can be a follow-up polish pass
- Any changes to edge functions, RPCs, or DB schema
