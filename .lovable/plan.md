# Per-Store Cashfree Gateway (Storefront Checkout)

Add Cashfree as a second store-level payment gateway, mirroring how Razorpay works today. Each store owner enters their **own** Cashfree App ID + Secret Key in Payment Settings. Customer payments on that storefront route to the merchant's Cashfree account.

**Strict isolation:** This is completely separate from the platform's SaaS billing Cashfree (which uses our `CASHFREE_APP_ID` env secret to charge merchants for the Pro plan). Different DB columns, different edge functions, different order ID prefixes — zero overlap.

**Mutual exclusion:** In Payment Settings, Razorpay and Cashfree act as radio choices — only one can be ON at a time. COD remains an independent toggle.

---

## What the merchant sees

**Store Settings → Orders & Payments**
- Cash on Delivery — independent toggle (unchanged)
- **Online Payment Gateway** — single selector with three states:
  - None
  - Razorpay (existing fields: Key ID, Key Secret)
  - Cashfree (new fields: App ID, Secret Key, Environment: Production / Sandbox)
- Switching from one to the other auto-disables the other. Saving validates that the chosen gateway's credentials are filled.
- Inline link to `https://merchant.cashfree.com/merchants/pg/developers/api` with 3-step instructions for fetching keys.
- Partial payment block continues to work, now triggered when **any** online gateway is enabled.

**Customer checkout**
- "Pay Online" option appears whenever the store has either Razorpay OR Cashfree enabled — single label, the merchant's chosen gateway opens behind the scenes.
- Cashfree opens via the official drop-in checkout (SDK already loaded for SaaS billing — reused).
- All Razorpay edge cases we already handle apply to Cashfree too: cancel → "Retry payment" CTA, dropped network → status check, auto-verify on tab focus, back-button guard, success → order confirmed, failure → order stays `pending` with retry.

---

## Database changes (one migration)

Add to `store_payment_config`:
- `cashfree_app_id text`
- `cashfree_secret_key text`
- `cashfree_env text default 'production'` (`'production'` | `'sandbox'`)

Update `payment_methods` jsonb to also accept `'cashfree'`. RLS unchanged (existing `is_store_owner` policies cover it).

Update `get_own_payment_secret` RPC → add a sibling `get_own_cashfree_secret(_store_id)` returning the cashfree secret only to store owner. Update `get_store_payment_config` RPC to also return `cashfree_app_id` and `cashfree_env` (NOT the secret — secret stays server-side).

---

## New edge functions (3, all isolated)

1. **`store-cashfree-create-order`** — verifies caller owns store, reads `store_payment_config` (merchant's CF creds), creates a Cashfree order with `order_id = ord_<orderUuid>` (note the `ord_` prefix vs. SaaS billing's `sub_` prefix — guarantees no collision), returns `payment_session_id` to the client. Validates amount, currency, store ownership, gateway enabled.

2. **`store-cashfree-verify`** — called after checkout success. Server-side fetches order status from Cashfree using merchant's creds; if `PAID`, updates `orders.status` to `confirmed` (or `partially_paid` for partial). Mirrors `razorpay-verify`.

3. **`store-cashfree-status`** — polled on tab focus / cancel / network blip. Returns current Cashfree order status without trusting client. Mirrors `razorpay-payment-status`.

All three use `verify_jwt = true` (default) since they're store-owner / authenticated-checkout flows. Each validates the merchant's Cashfree creds belong to **their** `store_payment_config` row — never falls back to platform secrets.

---

## Frontend changes

**`src/pages/StorePayments.tsx`**
- Replace independent Razorpay toggle with a "Online Gateway" selector (radio group: None / Razorpay / Cashfree). Existing Razorpay collapsible becomes one branch; new Cashfree collapsible becomes the other with App ID / Secret Key / Env fields.
- Save mutation validates only the selected gateway's fields. Persists `payment_methods` as `['cod', 'razorpay']` OR `['cod', 'cashfree']` (never both online).

**`src/pages/CheckoutPage.tsx`**
- Detect `hasCashfree = availableMethods.includes('cashfree')`.
- New `paymentMethod` value `'cashfree'`. UI label stays "Pay Online" — merchant's choice is invisible to customer.
- Pay handler branches: Razorpay → existing flow; Cashfree → call `store-cashfree-create-order`, open Cashfree drop-in via `loadCashfree(env)`, on `paymentDetails` event call `store-cashfree-verify`.
- Reuse the existing **edge-case handlers** built for Razorpay: cancel → retry CTA, focus-listener auto-verify (`store-cashfree-status`), `beforeunload` guard, pending-order recovery on remount.

**`src/lib/loadCashfree.ts`** — already exists and handles both `production` and `sandbox` modes; reused as-is.

---

## Edge cases handled

| Case | Behavior |
|---|---|
| User cancels Cashfree modal | Order stays `pending`, "Retry Payment" CTA appears, no duplicate order created on retry (idempotent — reuses same `orders.id`) |
| Tab loses focus mid-payment, user returns | `visibilitychange` listener calls `store-cashfree-status`; if PAID, auto-confirms; if FAILED, shows retry |
| User pays but network drops before frontend gets callback | Cashfree webhook would be ideal, but for v1 the focus-recheck + manual "I've paid, check status" button covers it |
| Merchant has both gateways' fields filled but flips selector | Only the active gateway is used at checkout; other creds remain in DB but are ignored (preserves data if they switch back) |
| Merchant disables online gateway entirely | `payment_methods = ['cod']`; checkout falls back to COD only |
| Merchant uses sandbox creds | `cashfree_env = 'sandbox'` routes API calls to `sandbox.cashfree.com` and SDK loads in sandbox mode |
| Wrong/expired creds | Cashfree returns auth error → edge function returns 502 with friendly message; checkout shows "Payment temporarily unavailable, try COD or contact store" |
| Mixing with SaaS billing | Different table (`orders` vs `subscription_payments`), different order prefix (`ord_` vs `sub_`), different env keys (merchant's vs platform's) — zero possibility of cross-contamination |

---

## Out of scope (intentionally)

- Cashfree webhook for store orders — focus-recheck + verify-on-success covers 99% of cases; webhook can be added later if needed.
- Migrating existing Razorpay merchants — they keep their setup untouched.
- Yearly/coupons/refunds UI — separate feature.

---

## Files touched

- DB migration: add 3 columns + new RPC + update RPC
- New: `supabase/functions/store-cashfree-create-order/index.ts`
- New: `supabase/functions/store-cashfree-verify/index.ts`
- New: `supabase/functions/store-cashfree-status/index.ts`
- Edited: `src/pages/StorePayments.tsx` (radio selector + Cashfree fields)
- Edited: `src/pages/CheckoutPage.tsx` (Cashfree branch in pay handler + status auto-recheck)
