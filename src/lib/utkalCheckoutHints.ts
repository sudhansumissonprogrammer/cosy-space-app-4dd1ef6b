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
/** Utkal-only founder note shown in the COD confirm sheet. */
export const UTKAL_COD_CONFIRM_NOTE = [
  "Hey! 👋 I'm Sudhansu, founder of Utkal Watch. ❤️",
  "🙏 A humble request: Please confirm only if you'll accept delivery, as refused COD parcels cost us shipping charges. 📦",
  "💳 Prepaid or Partial COD gets you faster delivery & special discounts!",
  "⭐ Have doubts? Check our 300+ customer reviews on Instagram.",
  "Thank you for your trust & support! ❤️",
];
export function utkalCodConfirmNote(store: StoreRef): string[] | null {
  return isUtkalContentStore(store) ? UTKAL_COD_CONFIRM_NOTE : null;
}

/** Display-only review count label. Utkal Watch shows "300+" because most of
 * its customer reviews live on WhatsApp/Instagram, not in the uploaded set. */
export function reviewCountLabel(storeId: string | null | undefined, total: number): string {
  return isUtkalContentStore({ id: storeId ?? null }) ? "300+" : String(total);
}
