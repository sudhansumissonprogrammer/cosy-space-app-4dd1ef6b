/** Utkal explicitly offers full COD alongside an optional online advance.
 * All other stores retain their required-advance policy. Use persisted IDs.
 */
export function requiresCheckoutAdvance(store: {
  id?: string | null;
  partial_payment_enabled?: boolean | null;
  partial_payment_value?: number | string | null;
}): boolean {
  return store.id !== "ab19143d-87a9-490e-90b7-837313522782" &&
    store.partial_payment_enabled === true && Number(store.partial_payment_value || 0) > 0;
}