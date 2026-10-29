/** Display the same capped delivery-balance reduction used by place-order. */
export function checkoutPartialAmounts(total: number, advance: number, discount: number) {
  const remaining = Math.max(0, total - advance);
  const appliedDiscount = Math.min(remaining, Math.max(0, discount));
  return {
    discount: appliedDiscount,
    total: Math.max(0, total - appliedDiscount),
    balance: remaining - appliedDiscount,
  };
}