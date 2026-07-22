## Goal
Let store owners mark a coupon as **auto-apply** in the dashboard. That coupon then applies itself the moment a shopper lands on checkout (no code typing), while the shopper can still remove it. Discounts stack correctly with existing prepaid / partial payment logic and are shown transparently.

---

## 1. Database — add `auto_apply` flag on coupons

Migration:
- `ALTER TABLE public.coupons ADD COLUMN auto_apply boolean NOT NULL DEFAULT false;`
- Partial unique index so only **one** auto-apply coupon can be active per store at a time (prevents ambiguity):
  `CREATE UNIQUE INDEX coupons_one_auto_apply_per_store ON public.coupons(store_id) WHERE auto_apply = true AND is_active = true;`
- Update RPC `get_store_auto_apply_coupon(_store_id uuid)` — returns the single active auto-apply coupon (code, discount_type, discount_value, min_order_amount, starts_at, expires_at). SECURITY DEFINER, `GRANT EXECUTE ... TO anon, authenticated` (checkout is public).
- Update `validate_store_coupon` — no changes needed (still the source of truth on apply).

## 2. Dashboard — `StoreCoupons.tsx`

- Add "Auto-apply" toggle to the create dialog (default off) and a new column in the table with an inline `Switch`.
- Server-side toggle mutation calls update; if enabling and another auto-apply coupon exists, DB unique index rejects — surface a friendly toast ("Only one auto-apply coupon allowed. Disable the current one first.").
- Small info line under the toggle: "Auto-apply coupons show as already applied on checkout. Shoppers can remove them."

## 3. Checkout — `src/pages/CheckoutV2Page.tsx`

- New query `["store-auto-apply-coupon", store.id]` calling the new RPC, staleTime 5 min.
- In the existing "auto-apply" `useEffect` (currently only handles `urlCoupon` from `?coupon=` / sessionStorage), extend it:
  - Priority: URL/session coupon → owner's auto-apply coupon.
  - Guard with `autoAppliedCouponRef` and `appliedCoupon` so a shopper who removed it isn't re-nagged in the same session (`removeCoupon` already sets ref = false; introduce a separate `dismissedAutoCouponRef` so removal is sticky within the checkout session).
  - Only apply once `subtotal > 0` and after `paymentConfig` is loaded (avoids racing the first mint).
- Coupon pill UI: when the applied coupon has `auto_apply=true`, replace the "Have a coupon?" pill with a compact green banner "Coupon **CODE** auto-applied · you save ₹X · Remove". No behavioural changes to manual entry flow.

## 4. Totals & payment display (no math change, only clarity)

Current invariants stay intact — verified against the code:
- **Subtotal** shows original prices.
- **Coupon discount** already appears as its own line (`−₹X`).
- **Full / prepaid**: `prepaidDiscount` is calculated on `total` (which already has coupon subtracted), so both stack automatically. Only change: keep the two lines separate ("Coupon −₹100" and "Prepaid discount −₹100") — clearer than merging them into one "₹200" number and matches what already renders. If you'd rather merge, I'll add a "You save ₹200" summary line above the pay button (no change to the itemised breakdown).
- **Partial payment**: existing rule preserved — coupon reduces the COD balance, advance stays as configured (so 1500 product − 100 coupon = 1400 total, ₹100 advance online, ₹1300 COD). Documented in a tooltip next to the advance amount.

## 5. Server — `place-order` edge function

- No functional change to pricing (server already re-validates coupon via `validate_store_coupon` + `claim_coupon`).
- Add: if the client-sent `coupon_id` doesn't match the store's current auto-apply coupon **and** the client didn't send any `coupon_id`, fall back to auto-applying it server-side too. This closes the race where the client mints an order in the ~200 ms before the auto-apply query resolves. Safe because it still runs the same validation + atomic claim.

## 6. Snapshot / re-mint safety

`paymentSnapshot` already includes `appliedCoupon?.id` + `couponDiscount`, so auto-applied coupons will trigger the existing re-mint path exactly like manual coupons. No new debounce/throttle needed.

## 7. Verification checklist

- Owner marks CODE10 as auto-apply → visit checkout in incognito → coupon banner shows applied, discount reflected in subtotal, prepaid, and partial breakdowns.
- Shopper clicks "Remove" → coupon clears, does not re-apply on further edits, does re-apply after page reload.
- Two auto-apply toggles on two coupons → dashboard blocks with clear error.
- Coupon + prepaid discount stack correctly (prepaid computed on post-coupon total).
- Partial payment: advance stays at configured value, coupon reduces COD balance.
- Order row minted server-side has correct `coupon_id`, `subtotal`, `coupon_discount`, `total`.

## Technical notes

- Files touched: `supabase/migrations/<new>.sql`, `supabase/functions/place-order/index.ts`, `src/pages/StoreCoupons.tsx`, `src/pages/CheckoutV2Page.tsx`.
- No changes to storefront theme layouts, cart pages, or product pages.
- Cache: dashboard mutation calls existing `purgeStore()`; checkout query staleTime 5 min so toggling auto-apply reflects within 5 min on live storefronts (or immediately after purge propagation).
