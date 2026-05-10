# Plan: Shopify-grade `AddPaymentInfo` for All Gateways

Goal: Fire `AddPaymentInfo` (browser pixel + CAPI mirror, deduped by `event_id`) whenever a customer picks a payment option in checkout — correctly labelled per store's actual gateway (Razorpay / Cashfree / COD-only / Partial-COD). One implementation works for every store: serdiyajewellers (Razorpay + partial), imitationworld (Cashfree + partial), COD-only stores, and full-online stores.

## Scope
Single file: `src/pages/CheckoutPage.tsx`. No edge function changes (`meta-capi` already accepts any `event_name`). No DB changes.

## Method resolution table

| User selection | State | Resolved `content_category` | `value` |
|---|---|---|---|
| COD button | `paymentMethod==="cod"` & not partial | `cod` | `total` |
| Partial advance (advance via Razorpay) | `paymentMethod==="razorpay"` & `partialPaymentMode==="partial"` & `activeGateway==="razorpay"` | `partial_cod_razorpay` | `partialAdvanceTotal` |
| Partial advance (advance via Cashfree) | same but `activeGateway==="cashfree"` | `partial_cod_cashfree` | `partialAdvanceTotal` |
| Full Online — Razorpay | `paymentMethod==="razorpay"` & `partialPaymentMode==="full"` & `activeGateway==="razorpay"` | `razorpay` | `total` |
| Full Online — Cashfree | same but `activeGateway==="cashfree"` | `cashfree` | `total` |
| COD-only store (no gateway) | `activeGateway===null` & `paymentMethod==="cod"` | `cod` | `total` |

## Steps

**1. Helper inside component** — `resolvePaymentInfo()` returns `{ category, value }` from the table above using existing `paymentMethod`, `partialPaymentMode`, `activeGateway`, `total`, `partialAdvanceTotal`, `isPartialOrder`.

**2. New `useEffect`** watching `[paymentMethod, partialPaymentMode, activeGateway, checkoutItems.length]`, placed right after the existing InitiateCheckout effect (line 571–597) so funnel order stays IC → AddPaymentInfo.

```text
useEffect:
  if (checkoutItems.length === 0) return;
  const { category, value } = resolvePaymentInfo();
  if (firedRef.current.has(category)) return;   // dedup per category
  firedRef.current.add(category);
  const eid = generateEventId();
  const data = { content_category: category, currency, value,
                 num_items, content_ids, contents };
  fbPixelTrack("AddPaymentInfo", data, eid);
  fireMetaCAPI({ storeId, eventName: "AddPaymentInfo", eventId: eid,
                 userEmail, userPhone, externalId, customData: data });
```

**3. Dedup ref** — `const firedRef = useRef<Set<string>>(new Set())`. Keyed by resolved `category`, so toggling COD↔Razorpay↔Partial each fires once but re-renders don't.

**4. COD-only store** — `paymentMethod` defaults to `"cod"` from mount, so the effect fires once after items load. No special case needed.

**5. Partial value correctness** — using `partialAdvanceTotal` (not `total`) for partial categories matches the actual amount Meta will see at Purchase, keeping Pixel↔CAPI value-match clean for ROAS optimization.

**6. Guards already in place** — `fbPixelTrack` and `fireMetaCAPI` both short-circuit on Lovable preview/dev hosts. Zero risk on non-prod.

## Verification
After deploy: open serdiyajewellers.shop checkout in Meta Pixel Helper → toggle COD/Online/Partial → see one `AddPaymentInfo` per category with correct `content_category` + `value`. Events Manager → CAPI tab → matching `event_id` dedup, EMQ ≥ 7.

## Out of scope (future)
- Adding CAPI access token (separate Settings step — biggest ROI, user already aware).
- COD-prominent UI redesign for the 73% Razorpay drop-off.
- AddPaymentInfo from V19/V20 custom checkout pages (only standard `CheckoutPage.tsx` covered here; other layouts use the same page).
