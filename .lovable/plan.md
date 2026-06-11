# Fix: Buy Now lead capture + InitiateCheckout tracking across all themes

## Goals
1. Show a phone-capture popup when shopper taps **Buy Now** (main button OR sticky bar) on any storefront theme — captures phone, saves to that store's `customer_leads`, autofills phone on the checkout page.
2. Fire **InitiateCheckout** (Meta Pixel + CAPI dedupe + GA4 `begin_checkout`) when shopper proceeds toward checkout, so main and sticky buttons have identical tracking and the funnel gap closes.
3. Do all of the above **without** any Google Maps / geolocation / reverse-geocode call (the prior version had those — this version drops them entirely).

## Current state — what I verified

| Item | Status |
|---|---|
| `BuyNowPhoneModal.tsx` | Exists. Captures phone, saves to `customer_leads`, autofills checkout via `localStorage["checkout_phone"]`. Also calls geolocation + reverse-geocode → we will **remove that call**. |
| `customer_leads` table | Already store-scoped. RLS: store owners SELECT/DELETE their own, anyone INSERT, admins manage all. |
| `/dashboard/stores/:storeSlug/leads` | Already exists (`CustomerLeads.tsx`) and reads from `customer_leads`. |
| Main PDP (`ProductDetail.tsx`) | `handleBuyNow` currently does **add-to-cart → navigate to checkout** with **no tracking and no modal** (the modal call was commented out). Main + sticky Buy Now both call same handler — tracking parity already guaranteed once we add it. |
| V22 PDP (`V22ProductDetail.tsx`) | Same shape — main + sticky Buy Now → `handleBuyNow` with no tracking. |
| V19/V20 PDP | Add-to-cart only. **No Buy Now button**, so no popup needed there. (V19/V20 cart pages do have "Proceed to Checkout" — covered below.) |
| Cart pages (4 variants) | All call `navigate(checkout)` with **no InitiateCheckout** firing. |
| Checkout autofill | Already reads `localStorage["checkout_phone"]` (line 158) and uses it as the initial `phone` state. ✅ Works as-is — we only need to make sure the modal writes it. |
| `fireMetaCAPI` supports `InitiateCheckout` | ✅ Already in the allowed event set (line 98). |
| `ga4Track` helper | ✅ Exists in `src/hooks/useGA4.ts`. |

## What I will change

### 1. Strip Maps/geolocation from `BuyNowPhoneModal.tsx`
- Delete the `triggerGeolocation()` function and all its call sites.
- Delete the late-arriving `checkout_address` re-check effect in `CheckoutPage.tsx` (lines ~169–202) — it only existed to catch the reverse-geocode race. Leave the `localStorage["checkout_phone"]` autofill untouched.
- Keep: phone validation, `customer_leads` insert (per-store), auto-login via `create-guest-account`, `localStorage["checkout_phone"]` write, navigate to checkout.
- Result: pop-up flow is **phone-only**, no location prompt, no third-party API.

### 2. Re-enable modal on Buy Now — every theme

**`src/pages/ProductDetail.tsx`** (covers themes V1–V18, V21):
- Add modal-open state.
- Rewrite `handleBuyNow` so that:
  - If `localStorage["checkout_phone"]` already has a valid 10-digit number → save a fresh `customer_leads` row, fire tracking, add to cart, navigate straight to checkout (no popup — returning shopper).
  - Otherwise → add to cart, open `BuyNowPhoneModal`. Modal's "Continue" saves the lead, writes `checkout_phone`, navigates to checkout.
- Render `<BuyNowPhoneModal>` once near the bottom of the JSX. Pass `storeId`, `productId`, `productName`, `source="buy_now_pdp"`.

**`src/pages/V22ProductDetail.tsx`**: same change, `source="buy_now_pdp_v22"`.

**V19/V20 PDPs**: skipped — they have no Buy Now button. (If you want one added later, separate ask.)

### 3. Fire InitiateCheckout — every theme, every entry point

Create a tiny shared helper `src/lib/trackInitiateCheckout.ts` so the call site is one line and the payload is consistent:

```text
trackInitiateCheckout({
  storeId, productId?, productName?,
  value, currency, numItems,
  contentIds: [productId]
})
```

It fires three things with a shared `event_id`:
- `fbPixelTrack("InitiateCheckout", payload, eid)` — browser Pixel
- `fireMetaCAPI({ eventName: "InitiateCheckout", eventId: eid, ...payload })` — server CAPI (dedupes by eid)
- `ga4Track("begin_checkout", { items, value, currency })` — GA4

Call sites added:
- `handleBuyNow` in `ProductDetail.tsx` (covers main + sticky — same function)
- `handleBuyNow` in `V22ProductDetail.tsx` (covers main + sticky — same function)
- `Proceed to Checkout` onClick in: `CartPage.tsx`, `V19CartPage.tsx`, `V20CartPage.tsx`, `V22CartPage.tsx`

Result: every path from PDP/cart → checkout fires identical InitiateCheckout. Meta's mid-funnel signal stops being empty.

### 4. Leads visibility — no DB changes needed
`customer_leads` is already store-scoped via RLS (`is_store_owner(store_id)`). The dashboard page already reads it. As long as the modal inserts the correct `store_id` (it does — we pass it in), leads will show up automatically in the right store's **Dashboard → Customer Leads** page, with the new `source` values (`buy_now_pdp`, `buy_now_pdp_v22`) visible in the source column.

## Files touched
- `src/components/storefront/BuyNowPhoneModal.tsx` — remove geolocation/reverse-geocode (~50 lines deleted)
- `src/pages/CheckoutPage.tsx` — remove `checkout_address` race-condition effect (~35 lines deleted)
- `src/pages/ProductDetail.tsx` — wire modal + tracking into `handleBuyNow`, render modal
- `src/pages/V22ProductDetail.tsx` — same as above
- `src/pages/CartPage.tsx`, `V19CartPage.tsx`, `V20CartPage.tsx`, `V22CartPage.tsx` — fire InitiateCheckout on Proceed click
- **New:** `src/lib/trackInitiateCheckout.ts` — shared helper

## Not touched (out of scope of this fix)
- WhatsApp order button on PDP — different funnel, has its own tracking pattern.
- Reverse-geocode edge function — left in place (used elsewhere on checkout's manual "use my location" button); we just stop auto-calling it from the popup.
- Landing page `LeadPopup` — separate marketing funnel, unrelated.

## How to verify after build
1. On any storefront PDP, tap **Buy Now** with a clean browser → modal opens, ask phone, on Continue: lead lands in **Dashboard → Customer Leads** for that store, checkout opens with phone prefilled, no location prompt appears.
2. Reload the same product, tap **Buy Now** again → modal is skipped (returning shopper), straight to checkout, phone prefilled, a fresh lead row added.
3. Tap the sticky bottom Buy Now (scroll past inline CTA) → same modal/flow.
4. Open Meta Events Manager → InitiateCheckout fires from both browser (Pixel) and server (CAPI) with the same event_id, deduped.
5. GA4 Realtime → `begin_checkout` event appears.
