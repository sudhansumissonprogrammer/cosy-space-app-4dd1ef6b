
# Redesign CheckoutV2 UI → GoKwik-style flow

Modify the existing new checkout (`src/pages/CheckoutV2Page.tsx`, 2292 lines — the one behind the current toggle) to match the GoKwik screenshots. **UI only.** Every existing hook, edge function, order-create call, payment launcher, coupon, address, COD, UPI-intent path stays exactly as-is — we only restructure JSX, styling, and section ordering.

Do NOT touch: `checkout-v2-cod`, `create-upi-intent`, `place-order`, `order-payment-status`, `cashfree-webhook`, `useStoreData`, DB schema, `stores.checkout_style` toggle logic. No new route, no new page, no new edge function.

## Target visual system

- Page bg `#F5F5F5`, white cards `rounded-xl` with `border-[#ECECEC]`, mobile-first max-width ~480px centered on desktop.
- Sticky top header: back arrow • store logo • right-aligned muted "100% Secured Payment 🔒".
- Sticky black announcement bar under header, message swaps with step:
  - login → "Unlock Extra Discount In Next Step"
  - address → "Re-check the delivery address"
  - payment → "Get Extra ₹50 Discount on UPI" (only if a UPI offer exists, else generic)
- Sticky bottom bar: full-width black `Continue` button (disabled = gray), fine legal line under it.
- Section labels uppercase muted (`DELIVERY DETAILS`, `OFFERS & REWARDS`, `PAYMENT OPTIONS`).

## Section-by-section changes inside CheckoutV2Page

### 1. Login step (screens 1–3)
- **Order Summary card**: cart icon, title, green pill "₹X saved so far" (from existing discount total), right side strikethrough MRP + final + chevron to expand line items (reuse current cart items list, just restyled).
- **Offers card**: green header "You saved ₹X" → coupon input → applied coupon row (green check, code, "View all coupons ›", `Remove`). Loyalty earn line only if store has loyalty configured — else hide.
- **Login card**: pale-yellow header strip, phone input `+91 | Enter Mobile Number`, numeric keypad (`inputMode="numeric"`). Reuse existing OTP send/verify handlers.
- Consent checkbox "Send me order updates & offers - (no spam)".

### 2. Address step (screens 4–5, 7, 8)
- If no saved address → open bottom-sheet "Add Delivery Address":
  - Pincode* (triggers existing city/state lookup, both fields become readonly).
  - Flat/House no.*, Apartment/Area/Sector/Village*, Full Name*, Email*.
  - Save Address As pill toggles: Home / Work.
  - Shipping Method card (radio) — populated from existing shipping methods query; default "Free Shipping — Free".
  - Inline red validation copy exactly like screen 6.
- If saved addresses exist → "Select Delivery Address" sheet (screen 8): each card = name + Home/Work chip + edit pencil + address lines + email, black `Deliver Here` button. Top-right `+ Add New Address`.
- Collapsed **Delivery Details** summary card (screen 7): pin icon, "Deliver To {name}", black "Tap To Edit Address" tooltip, address lines, phone | email, `Change` button. Free-shipping chip row below.

### 3. Payment step (screens 9–10)
Wrapper `PAYMENT OPTIONS` label, cards in this order (only render methods the store has enabled — same source as today):
- **UPI card**: red "Get ₹50 Off" ribbon (only if UPI discount configured), UPI logo left, amount right. 4 pastel app tiles (Paytm, PhonePe, GPay, Amazon Pay) with "Win Cashback" chip on eligible ones. Row: `All UPI Apps  N Deals Available  ›` → opens existing UPI-apps sheet.
- **Debit/Credit Cards** row: amount + chevron → existing card form.
- **0% EMI on UPI & Cards** row (Snapmint) — only if enabled today.
- **EMI** row — only if enabled.
- **Netbanking** row.
- **Wallets** row with green "Get cashback" chip if applicable.
- **Cash on Delivery** row: red "₹{fee} COD fee added" chip, price reflects COD fee (already computed today).
- Logged-in strip: avatar + "Logged in using +91 …" + `Logout` (reuse existing logout).
- Trust footer: our brand "Powered by" badge, "Powering secure checkout experiences for N+ brands", PCI DSS / Secured Payments / Verified Merchant badges row.

## Component extraction (new files, kept small)

Create under `src/components/storefront/checkout-v2/`:

```text
CheckoutHeader.tsx
AnnouncementBar.tsx
StickyContinueBar.tsx
OrderSummaryCard.tsx
OffersCard.tsx
LoginCard.tsx
AddressSheet.tsx
AddressListSheet.tsx
DeliverySummaryCard.tsx
ShippingMethodCard.tsx
PaymentUpiCard.tsx
PaymentRow.tsx
TrustFooter.tsx
```

CheckoutV2Page.tsx becomes the orchestrator: state machine `step: 'login' | 'address' | 'payment'` (derive from existing auth + address state), renders sections + sticky bars. All data/handlers passed as props — no new contexts.

## Non-goals

- No Beast Cash loyalty engine, no real Snapmint integration, no new UPI deep-linking. Ribbons/chips are cosmetic and driven from a local config object; only shown when the underlying feature is already enabled on the store.
- GoKwik logos replaced with our own brand.
- No changes to pricing math, order creation, webhooks, or the toggle.

## Verification

- Toggle ON for a test store → walk login → address (new + saved) → payment on 628px preview.
- Confirm PayU / Razorpay / Cashfree / UPI-intent / COD launchers still fire the same edge functions with the same payloads (compare network tab).
- Confirm existing pricing (1000 → −100 coupon → 900 → 100 advance → 800 due) still renders correctly in Order Summary + Payment amounts.
