
## Goal

Kill the BuyNowPhoneModal popup. Replace it with a **2-step in-page checkout** (Step 1 = phone, Step 2 = address & payment). The moment a phone is entered in Step 1, capture it as both a **lead** AND an **abandoned cart** row so WhatsApp recovery + admin visibility work automatically.

---

## Current state (audit)

- `CheckoutPage.tsx` (default) + `V22CheckoutPage.tsx` (theme 22) are the two active checkouts.
- `BuyNowPhoneModal` opens as a popup on PDP "Buy Now" and inserts into `customer_leads` only.
- `abandoned_carts` table already exists with `customer_phone`, `cart_items`, `session_token`, `wa_marketing_consent`, and is what `wa-cart-recovery-cron` reads to fire WhatsApp templates.
- `customer_leads` is separate (name/phone/product) — currently NOT connected to abandoned carts, so leads never trigger recovery messages.

The gap: phone numbers collected at PDP live in `customer_leads` and go nowhere. Abandoned-cart recovery only fires when someone reaches checkout AND drops off.

---

## New flow

```text
PDP "Buy Now" / Cart "Checkout"
        │
        ▼
┌─────────────────────────────────┐
│ CheckoutPage · STEP 1           │
│ ─────────────────────────────── │
│ • Order summary (mini)          │
│ • Phone input (+91 …)           │
│ • WhatsApp consent (default ON) │
│ • [Continue] button             │
└─────────────────────────────────┘
        │  onContinue()
        │  1. validate 10-digit IN phone
        │  2. upsert customer_leads (store, phone, source='checkout_step1')
        │  3. upsert abandoned_carts (store, phone, cart_items, consent, session_token)
        │  4. localStorage.setItem('checkout_phone', ...)
        ▼
┌─────────────────────────────────┐
│ CheckoutPage · STEP 2           │
│ ─────────────────────────────── │
│ • Name, address, pincode        │
│ • Delivery / payment            │
│ • [Place Order]                 │
└─────────────────────────────────┘
        │  onPlaceOrder()
        │  → mark abandoned_carts.recovered = true
        ▼
     Order placed
```

If the user closes the tab between Step 1 and Step 2 → row sits in `abandoned_carts` with a phone number → `wa-cart-recovery-cron` fires `abandoned_cart_v3` template after ≥30 min.

---

## Deliverables

### 1. New shared component `src/components/storefront/CheckoutPhoneStep.tsx`
- Phone input + consent checkbox + Continue.
- On submit: writes to `customer_leads` AND `abandoned_carts`, sets `sessionStorage.checkout_phone`.
- Emits `onComplete(phone)` to parent.

### 2. `src/pages/CheckoutPage.tsx` — 2-step layout
- Add `step` state (`"phone" | "details"`).
- Step 1 renders `<CheckoutPhoneStep />` + order summary.
- Step 2 renders the current form; auto-fills phone from Step 1 (read-only with "change" link that goes back to Step 1).
- Mobile: single column, sticky order summary at bottom.
- Desktop: 2-col — form left, summary right.
- Progress indicator: `● Phone —— ○ Details`.

### 3. `src/pages/V22CheckoutPage.tsx` — same 2-step, V22 styling
- Reuse `CheckoutPhoneStep`.
- Match V22's card design.

### 4. Remove `BuyNowPhoneModal` popup usage
- PDP "Buy Now" → navigate straight to `/checkout` (which now starts with phone step).
- Delete popup imports from PDP files (`ProductDetail.tsx`, `V19ProductDetail.tsx`, `V20ProductDetail.tsx`, `V22ProductDetail.tsx`).
- Keep `BuyNowPhoneModal.tsx` file for now (marked deprecated in header comment) — can be deleted in a follow-up once confirmed unused.

### 5. Lead → abandoned-cart bridge (RPC)
New DB function `capture_checkout_lead(p_store_id, p_phone, p_cart_items jsonb, p_consent bool)`:
- Normalizes phone to canonical 10-digit.
- Upserts into `customer_leads` (source = `checkout_step1`).
- Upserts into `abandoned_carts` keyed on `(store_id, customer_phone, session_token)` — resets `recovered=false`, `recovery_sent_at=null`.
- Grants `EXECUTE` to `anon` and `authenticated` (checkout runs pre-auth).

### 6. Recovery attribution
- `wa-cart-recovery-cron` already skips `recovered=true`.
- Order confirmation edge fn already marks the matching cart recovered — extend the phone-match to include our new Step-1 rows.

### 7. Admin visibility
- `CustomerLeads.tsx`: add filter chip **Source: checkout_step1** with count badge.
- `StoreAbandonedCarts.tsx`: add badge column `Stage: phone-only | full-cart` so merchants see which carts dropped at Step 1 vs Step 2.

---

## Technical details

- Phone normalization: reuse `toCanonicalIndianPhone` in `src/lib/phoneUtils.ts` on client, mirror inside the new RPC (`regexp_replace` + length check) — same rules as `create-guest-account`.
- Consent default: `true` (already the platform default per prior turn); user can uncheck.
- Rate-limit Step 1 submit: 1 per 5 s per session to prevent spam.
- No auth required for Step 1 — abandoned_carts already accepts anon writes via existing RLS; the new RPC runs SECURITY DEFINER and validates `store_id` exists + is active.
- Session token: use existing `visitorSession.ts` helper so recovery joins the right cart on order creation.
- Tests: add vitest for `CheckoutPhoneStep` (validation, RPC call, error state) and one integration test for step transition.

---

## Out of scope (do later)

- OTP verification on the phone step (add once we have WhatsApp OTP template approved).
- Address autocomplete / pincode → city lookup.
- Migrating existing pre-checkout `customer_leads` rows into `abandoned_carts` retroactively.
