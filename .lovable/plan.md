# Fix checkout payment-method visibility

## Desired behaviour (your rules)

| Store config | Options shown at checkout |
|---|---|
| Partial COD ON + online gateway installed | **Advance Online + Balance COD** and **Pay Full Online** only — no plain COD |
| COD enabled, no partial, online gateway installed | **COD** and **Pay Full Online** |
| COD enabled, no online gateway | **COD** only |
| Only online gateway (no COD) | **Pay Full Online** only |

The UI in `src/pages/CheckoutPage.tsx` (lines 2354–2431) already follows this — *when* `paymentConfig` has loaded.

## Root cause of Sandeep's COD order (628f8e69…)

`CheckoutPage.tsx` line 440:
```
const availableMethods = paymentConfig?.payment_methods || ["cod"];
```
Before the `get_store_payment_config` RPC resolves (slow 3G / RPC error / cold cache), the page assumes COD-only. That makes `hasOnline=false`, hides the partial block, and shows the plain COD button. A fast tap on Place Order writes `payment_method=cod`, `payment_type=full`, `status=confirmed` — bypassing the partial-payment requirement.

The Cart→Checkout flow has no other gate, so the customer never sees the correct option set.

## Fix (frontend only, `src/pages/CheckoutPage.tsx`)

1. **Remove the unsafe fallback.** Replace
   ```
   const availableMethods = paymentConfig?.payment_methods || ["cod"];
   ```
   with
   ```
   const paymentConfigLoaded = paymentConfig !== undefined; // query settled
   const availableMethods = paymentConfig?.payment_methods ?? [];
   ```
   Until the RPC settles, no method flags are true → no payment buttons render.

2. **Skeleton while loading.** In the Payment block (line 2342), if `!paymentConfigLoaded`, render a small "Loading payment options…" skeleton instead of the buttons, so the user never sees a stale COD-only state.

3. **Disable Place Order until loaded + valid selection.** In the Place Order button (around line 685 handler and its button render), add guards:
   - `disabled` when `!paymentConfigLoaded`
   - `disabled` when `hasAnyPartialPayment && hasOnline && paymentMethod === "cod"` (defensive — should be impossible after fix #1)
   - In `handlePlaceOrder`, early-return with a toast if either condition is true.

4. **Default-selection effect (line 450).** Keep current logic but also guard with `if (!paymentConfigLoaded) return;` so we don't briefly set `cod` before config arrives.

5. **Query hardening.** Add `retry: 2` and `refetchOnWindowFocus: false` to the `paymentConfig` `useQuery` so a transient network blip doesn't leave it permanently `undefined`. On error, surface a toast and keep Place Order disabled.

## Out of scope (call out, do not change here)

- Server-side enforcement (edge function rejecting `cod`+`full` when store has partial enabled). Worth doing in Phase 1 of the earlier security audit, but this plan is UI-only per your request.
- The existing Sandeep order — no data change needed unless you want it reclassified.

## Files touched

- `src/pages/CheckoutPage.tsx` only.

No DB migration, no edge-function change, no other components.
