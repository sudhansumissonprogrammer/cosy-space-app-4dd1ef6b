import { isUtkalContentStore } from "../../supabase/functions/_shared/utkalContent";

type StoreRef = { id?: string | null; slug?: string | null };
export function utkalDeliveryHint(store: StoreRef, mode: "full" | "partial"): string | null {
  if (!isUtkalContentStore(store)) return null;
  return mode === "full"
    ? "Get delivered under 3 days with air shipping"
    : "Get delivered under 3 days";
}
export function utkalCodHint(store: StoreRef): string | null {
  return isUtkalContentStore(store)
    ? "70% of our customers choose prepaid — get discount & faster delivery"
    : null;
}

/** Utkal-only flat ₹50 off for choosing the online advance (partial COD).
 * Comes out of the delivery balance, never the advance — same rule as coupons.
 * The server recomputes this in place-order; the client value is display-only. */
export const UTKAL_PARTIAL_DISCOUNT = 50;
export function utkalPartialDiscount(store: StoreRef): number {
  return isUtkalContentStore(store) ? UTKAL_PARTIAL_DISCOUNT : 0;
}