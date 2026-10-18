import { isKalingaStore } from "./kalingaStore";

/** Displayed payment promotion only; does not change the charged amount. */
export function checkoutCashback(store: { id?: string | null; slug?: string | null } | null | undefined, isPartialOrder: boolean): number {
  return isKalingaStore(store) || isPartialOrder ? 50 : 100;
}