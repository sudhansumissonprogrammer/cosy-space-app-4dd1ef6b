
# GoKwik-Clone Checkout — Safe Build Plan

Goal: exact GoKwik UX — one page shows address + payment tiles (GPay, PhonePe, Paytm, Any UPI, UPI ID, Card, COD). Tapping GPay opens the GPay app directly. No PG page ever shown. Built **behind a feature flag** so the live checkout, running ads, and current sales are 100% untouched until you flip it on.

---

## What stays UNCHANGED (safety guarantee)

- Existing `CheckoutPage.tsx`, `V22CheckoutPage.tsx`, all V19/V20/V22 cart flows — **not modified**.
- Existing edge functions (`razorpay-order`, `razorpay-verify`, `store-cashfree-create-order`, `store-cashfree-verify`, `payu-create-txn`, `payu-webhook`) — **not modified**.
- All live stores continue to use the current "Pay Now → PG modal" flow. Ads, pixel, CAPI, conversions untouched.

---

## The new UX (matches GoKwik exactly)

```text
┌─────────────────────────────────────┐
│  ← Back              Order  ₹1,249  │
├─────────────────────────────────────┤
│  📱 +91 98xxx xxxxx     ✓ Verified  │
│  📍 Ravi · H.No 12, Jaipur 302001   │
│     [Change]                        │
├─────────────────────────────────────┤
│  Pay ₹1,249                         │
│                                     │
│  UPI apps                           │
│  ┌───────┐ ┌───────┐ ┌───────┐     │
│  │ GPay  │ │PhonePe│ │ Paytm │     │
│  └───────┘ └───────┘ └───────┘     │
│  ┌─────────────────────────┐       │
│  │ ▶ Any UPI app           │       │
│  └─────────────────────────┘       │
│  ┌─────────────────────────┐       │
│  │ Enter UPI ID  [______]  │       │
│  └─────────────────────────┘       │
│                                     │
│  Other                              │
│  💳 Credit / Debit Card             │
│  🏦 Netbanking                      │
│  💵 Cash on Delivery                │
└─────────────────────────────────────┘
```

Tap **GPay** → GPay app opens with ₹1,249 pre-filled → user approves → we poll → order confirmed → thank-you page. No Razorpay/Cashfree page ever appears.

Desktop → same tiles show a QR code instead (UPI apps aren't installed on desktop).

---

## Architecture

### New edge functions (all dormant until UI calls them — zero risk)

1. **`create-upi-intent`** — accepts `{ order_id, store_id, app: "gpay"|"phonepe"|"paytm"|"any", vpa? }`; picks active PG from `store_payment_config` (Cashfree first, then Razorpay, then PayU); calls that PG's UPI Intent API; returns `{ intent_url, order_ref, poll_token }`.
   - Cashfree: `POST /pg/orders/sessions` with `payment_method.upi.channel="link", app=...`.
   - Razorpay: reuse existing `razorpay-upi-intent/index.ts` (already built, currently unused) — just call it from the wrapper.
   - PayU: S2S `_payment` with `bankcode=TEZ | PHONEPE | PAYTM | UPI`.

2. **`create-card-session`** — returns a payment session token for the chosen PG's on-page card iframe (Razorpay Elements or Cashfree Drop card-only mode). No new PG code, just a thin wrapper for the tile UI.

3. **`order-payment-status`** — single polling endpoint the tile UI hits every 2s. Reads `orders.status` and (if pending) queries the active PG's status API. Returns `pending | success | failed`.

### New frontend files (all new, replace nothing)

- `src/pages/CheckoutV2.tsx` — new checkout page, mounted only when feature flag is on.
- `src/components/checkout-v2/AddressBlock.tsx` — phone + saved address, edit-in-place.
- `src/components/checkout-v2/PaymentTiles.tsx` — the tile grid.
- `src/components/checkout-v2/UpiAppTile.tsx` — one tile (GPay/PhonePe/Paytm/Any). Pre-generates intent URL on mount so the tap fires `location.href = intentUrl` synchronously (required for iOS Safari).
- `src/components/checkout-v2/UpiIdInput.tsx` — VPA input + Verify + Pay (UPI Collect flow).
- `src/components/checkout-v2/CardTile.tsx` — mounts Razorpay/Cashfree card iframe inline.
- `src/components/checkout-v2/UpiQrDesktop.tsx` — QR fallback for desktop.
- `src/components/checkout-v2/WaitingScreen.tsx` — "Complete payment in GPay… (up to 3 min)" with polling.
- `src/assets/upi/gpay.svg`, `phonepe.svg`, `paytm.svg`, `bhim.svg` — official brand icons (already have GPay/PhonePe/Paytm SVGs in `public/icons/`).

### Feature flag (per-store, admin-controlled)

- Add one boolean column: `stores.checkout_v2_enabled boolean default false`.
- Route logic in `CheckoutPage.tsx` (tiny 3-line change — the only edit to existing checkout code): if `store.checkout_v2_enabled === true` **and** URL has `?v2=1` OR store is fully opted-in, render `<CheckoutV2 />` instead of the current form. Otherwise render existing checkout unchanged.
- Admin panel gets one toggle in `StorePayments.tsx`: **"Enable new 1-click checkout (beta)"** — off by default for all existing stores.
- Rollout: you flip it on for **one test store** first → watch 10–20 real orders → then enable per-store as you gain confidence.

---

## Rollout stages (each stage is independently reversible)

**Stage 1 — Backend only, invisible**
- Deploy `create-upi-intent`, `create-card-session`, `order-payment-status`.
- Add `stores.checkout_v2_enabled` column (default false = nobody sees it).
- Zero UI change. Zero live impact.

**Stage 2 — UI behind `?v2=1` URL param**
- Ship `CheckoutV2.tsx` + tile components.
- Only reachable by visiting `/checkout?v2=1` manually.
- Test on preview URL with Cashfree sandbox → real UPI sandbox → real ₹1 live order on one store.

**Stage 3 — Enable on one test store**
- Flip `checkout_v2_enabled=true` for one low-volume store.
- Compare conversion vs old flow for 3–5 days.

**Stage 4 — Gradual rollout**
- Enable per-store from admin panel as you gain confidence.
- Old checkout remains as instant fallback — flip flag back to `false` to revert any store in 1 click.

---

## Critical technical details

- **iOS UPI intents must fire in the same tap event**, no `await`. Solution: `UpiAppTile` pre-fetches the intent URL on mount so tap = synchronous `location.href = url`.
- **Intent TTL ≈ 5 min** — regenerate if user idles past 4 min.
- **UPI apps rarely redirect back** — we rely on 3-minute polling + PG webhook. Waiting screen shows a "I've paid" button that immediately re-polls.
- **App detection** — on Android/iOS, hide GPay/PhonePe/Paytm tiles when `navigator.userAgent` says the app isn't installable (fallback: always show, they'll get "app not found").
- **Card iframe** uses Razorpay's card-only mode or Cashfree Drop with `components: ['card']` — never leaves the page.
- **Missing Cashfree/Razorpay webhooks (open gap flagged by exploration)** — Stage 1 also adds `cashfree-webhook` and `razorpay-webhook` public endpoints as safety net so orders never stick in "pending" even if the browser dies mid-payment. This benefits the OLD checkout too.

---

## What you approve now

Stages 1–2 only (backend + UI behind `?v2=1`). Nothing goes live to real customers, no store gets the new flow, ads/sales completely untouched. After you test on the preview URL and are happy, you tell me to move to Stage 3.

Say "go" to start Stage 1.
