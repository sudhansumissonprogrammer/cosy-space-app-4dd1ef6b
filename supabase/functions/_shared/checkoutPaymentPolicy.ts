/** Every store follows its dashboard-configured required-advance policy. */
export function requiresCheckoutAdvance(store: {
  id?: string | null;
  partial_payment_enabled?: boolean | null;
  partial_payment_value?: number | string | null;
}): boolean {
  return store.partial_payment_enabled === true && Number(store.partial_payment_value || 0) > 0;
}