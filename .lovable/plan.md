
# PayU Merchant Hosted (Bolt) Integration — Production-Grade Plan

Goal: ship PayU as a third online gateway alongside Razorpay & Cashfree with the **same reliability bar**: no double charges, no broken UPI returns, no lost payments on tab refresh, accurate Meta CAPI reporting.

---

## 1. What we copy from the existing gateways

| Capability | Razorpay (today) | Cashfree (today) | PayU (new) |
|---|---|---|---|
| Owner adds keys in Store Payments | ✅ | ✅ | ✅ same UI pattern |
| Per-store keys in `store_payment_config` | ✅ | ✅ | ✅ add 3 columns |
| Secret-key never sent to browser | ✅ (RPC `get_own_*_secret`) | ✅ | ✅ same RPC pattern |
| Server creates order/hash | `razorpay-order` | `cashfree-create-order` | `payu-create-txn` |
| Server verifies signature | `razorpay-verify` (HMAC) | `cashfree-verify-payment` (API) | `payu-verify-payment` (SHA-512 reverse hash) |
| Webhook idempotent | `cashfree-webhook` | `cashfree-webhook` | `payu-webhook` |
| Retry-safe verify polling | ✅ 8-step backoff | ✅ 8-step backoff | ✅ copy verbatim |
| Tab refocus auto-recheck | ✅ | ✅ | ✅ copy verbatim |
| UPI intent return recovery | ✅ `razorpay-payment-status` | ✅ `store-cashfree-status` | ✅ `payu-status` |
| Meta CAPI Purchase fired on verify | ✅ `firePurchaseCapi` | ✅ `firePurchaseCapi` | ✅ same hook |
| Prewarm SDK + edge fns on mount | ✅ | ✅ | ✅ |
| Partial/advance payment support | ✅ | ✅ | ✅ |
| SDK preload deduped | ✅ | ✅ `loadCashfree` | ✅ `loadPayuBolt` |

---

## 2. Why PayU **Merchant Hosted (Bolt)**, not Hosted

- Customer stays on `brand.shopbanao.in` — no redirect to PayU domain (same UX as Razorpay modal & Cashfree drop-in)
- Lower drop-off, branded experience, faster return
- PayU Bolt handles PCI/UPI/Cards/NetBanking inside a secure overlay on our site
- Server still owns hash generation & verification → keys never exposed

---

## 3. Database changes

### Migration: add PayU columns

```sql
ALTER TABLE public.store_payment_config
  ADD COLUMN IF NOT EXISTS payu_merchant_key text,
  ADD COLUMN IF NOT EXISTS payu_merchant_salt text,
  ADD COLUMN IF NOT EXISTS payu_env text NOT NULL DEFAULT 'production'
    CHECK (payu_env IN ('production','sandbox'));
```

### Secret-fetch RPC (mirrors `get_own_cashfree_secret`)

```sql
CREATE OR REPLACE FUNCTION public.get_own_payu_secret(_store_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT payu_merchant_salt
  FROM store_payment_config
  WHERE store_id = _store_id
    AND (is_store_owner(_store_id) OR has_role(auth.uid(),'admin'));
$$;
GRANT EXECUTE ON FUNCTION public.get_own_payu_secret(uuid) TO authenticated;
```

`payment_methods` jsonb already supports adding `"payu"` — no schema change needed there.

---

## 4. Edge functions (4 new)

All use the same CORS + service-role + `firePurchaseCapi` hooks as Razorpay/Cashfree.

### 4.1 `payu-create-txn`
- Input: `{ store_id, order_id }`
- Reads order + `store_payment_config`
- Generates `txnid` = our `order.id` (idempotent — never two PayU txns per order)
- Computes hash: `sha512(key|txnid|amount|productinfo|firstname|email|udf1...udf5|||||salt)`
- Returns: `{ key, txnid, amount, productinfo, firstname, email, phone, surl, furl, hash, env }`
- Stamps `orders.payment_gateway_ref = txnid`, `orders.payment_gateway = 'payu'`
- **SURL/FURL** point at `https://<project>.functions.supabase.co/payu-return?order_id=…` so even hard-redirect fallback works

### 4.2 `payu-verify-payment`
- Input: `{ order_id, store_id, txnid? }`
- Source of truth: PayU **verify_payment API** (`/merchant/postservice?form=2`, command=`verify_payment`)
- Validates **reverse hash**: `sha512(salt|status|||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)`
- Verdicts: `paid` / `pending` / `failed` / `cancelled`
- On `paid`: updates `orders.status`, fires `firePurchaseCapi`, idempotent on `payment_verified_at`
- Never trusts client-posted response alone

### 4.3 `payu-webhook`
- PayU calls this on async status changes (UPI collect, bank delays)
- Verifies reverse hash with stored salt
- Idempotent via `webhook_events` table (`event_id = txnid + status + amount`)
- Same `firePurchaseCapi` call → guaranteed Purchase fires even if user never returns to tab

### 4.4 `payu-status` (lightweight poll)
- Used by tab-refocus & UPI-return polling
- Calls verify_payment API, returns `{ status, amount, payment_id }` only — no DB write
- Fast path for the browser polling loop

### config.toml additions

```toml
[functions.payu-webhook]
verify_jwt = false
```

---

## 5. Frontend changes

### 5.1 `src/lib/loadPayuBolt.ts` (new — mirrors `loadCashfree.ts`)
Single-flight loader for `https://jssdk-uat.payu.in/bolt/bolt.min.js` (sandbox) / `https://jssdk.payu.in/bolt/bolt.min.js` (prod). Caches `loadingPromise`, attaches once.

### 5.2 `src/pages/StorePayments.tsx`
Add PayU as a third option in the gateway radio group (Razorpay / Cashfree / **PayU**):
- Merchant Key (text)
- Merchant Salt (password, masked, server-fetched via `get_own_payu_secret`)
- Env: Production / Sandbox toggle
- Inline help: where to find these in PayU dashboard
- **Only one online gateway active at a time** (existing constraint preserved)

### 5.3 `src/pages/CheckoutPage.tsx`
Extend `OnlineGateway` type to `"razorpay" | "cashfree" | "payu"`:

```ts
const activeGateway = hasRazorpay ? "razorpay" 
                    : hasCashfree ? "cashfree" 
                    : hasPayu ? "payu" 
                    : null;
```

Add PayU branch in the existing payment flow:
1. **Prewarm**: load Bolt SDK + prewarm `payu-create-txn` / `payu-verify-payment` / `payu-status` on mount
2. **Open**: `bolt.launch(payuParams, { responseHandler, catchException })`
3. **Verify**: always call `payu-verify-payment` after Bolt closes (server is truth)
4. **Tab refocus**: same `visibilitychange` + `focus` listener already used for Cashfree → calls `payu-status`
5. **UPI return**: if `responseHandler` never fires (UPI app return), the focus listener + 5s poll loop will catch it
6. **Refresh recovery**: `pendingOrderRef` is keyed on `order_id` in sessionStorage — survives refresh; on mount, if a pending PayU order exists, auto-resume polling

### 5.4 Refresh-recovery enhancement (applies to all 3 gateways)
Currently `pendingOrderRef` lives in React state. Promote to **sessionStorage**:

```ts
// key: `pending_payment_<order_id>`
// value: { gateway, txn_ref, created_at }
```
- On `CheckoutPage` mount → if found AND not expired (<15min) → resume verify-polling loop and show "Checking your payment…" overlay
- Cleared on terminal verdict (paid/failed/cancelled)
- Same fix benefits Razorpay & Cashfree, not just PayU

### 5.5 Meta Pixel Purchase (browser)
Already dedup'd via `meta_purchase_fired_<orderId>` + `event_id`. PayU branch fires identically after server verdict = paid. No change needed — just call site in the new branch.

---

## 6. Failure & edge-case matrix

| Scenario | Handling |
|---|---|
| User closes Bolt mid-payment | `catchException` → verify → "Payment cancelled" UI |
| UPI collect — user pays in GPay, never returns | Webhook fires `payu-webhook` → DB updated. If user does return, focus listener calls `payu-status` → shows success |
| User refreshes tab mid-payment | sessionStorage `pending_payment_<order_id>` → on mount auto-polls `payu-status` |
| Double-tap "Pay" button | Button disabled during `busy`; server-side `txnid = order.id` is idempotent — second `payu-create-txn` re-uses same txn |
| Hash tampering | Reverse hash verified server-side; mismatch → rejected, order stays unpaid |
| Network drop during verify | 8-step backoff: 0.6s → 1.2 → 1.8 → 2.5 → 3.5 → 4.5 → 6 → 6s (~20s coverage) |
| Webhook arrives before verify | `webhook_events` dedup + `payment_verified` flag → only one CAPI fire |
| Verify arrives before webhook | Verify wins, webhook becomes a no-op via idempotency |
| Refund / chargeback | Out-of-scope this round (note for future: PayU refund API) |
| Sandbox vs production | `payu_env` column → SDK URL + API host both switch |

---

## 7. Meta CAPI / Pixel parity
- Server: `firePurchaseCapi(supabase, order_id, { source: "payu" })` called from `payu-verify-payment` AND `payu-webhook` (function is idempotent via `meta_purchase_fired` flag)
- Browser: existing Pixel Purchase block in CheckoutPage reused — same `event_id` so dedup works
- Real revenue (sale price / order total) — not MRP (already correct in checkout)

---

## 8. Build order (so nothing breaks at any step)

1. DB migration (cols + RPC + GRANT)
2. `payu-create-txn` + `payu-verify-payment` + `payu-status` + `payu-webhook` edge functions
3. `loadPayuBolt.ts`
4. `StorePayments.tsx` — owner can save keys
5. `CheckoutPage.tsx` — PayU branch + sessionStorage refresh-recovery
6. Manual smoke test (sandbox): card success, card fail, UPI collect with tab-close, UPI collect with refresh, double-click pay, webhook-only flow
7. Update Meta CAPI memory note + edge functions inventory
8. Ship

---

## 9. What this does NOT change

- Existing Razorpay & Cashfree flows untouched (only minor: sessionStorage recovery is additive)
- `firePurchaseCapi`, order schema, RLS model, billing — unchanged
- Worker, fonts, R2, themes — unchanged

---

## 10. Required from you before I start coding

Just one confirmation:
- **Approve this plan** and I begin step 1 (DB migration). 
- I do **not** need PayU keys yet — owner adds them per-store in Store Payments after the UI ships.

Approve and I'll execute.
