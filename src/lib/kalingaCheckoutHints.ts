import { isKalingaStore } from "./kalingaStore";

type StoreRef = { id?: string | null; slug?: string | null } | null | undefined;

/**
 * Display-only nudge under the UPI price. Never changes the charged amount,
 * shipping rules or delivery promise for any other store.
 */
export function kalingaUpiDeliveryHint(store: StoreRef): string | null {
  return isKalingaStore(store) ? "Fast delivery under 3 days" : null;
}

/**
 * Display-only nudge on the cash-on-delivery button, pointing shoppers at the
 * prepaid option. Never changes the COD amount or the prepaid discount itself.
 */
export function kalingaCodPrepaidHint(store: StoreRef): string | null {
  return isKalingaStore(store)
    ? "70% of our customers choose prepaid — get discount & faster delivery"
    : null;
}
