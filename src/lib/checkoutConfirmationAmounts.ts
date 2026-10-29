interface ConfirmationInput {
  total: number;
  prepaidTotal: number;
  isPartial: boolean;
  paymentMethod: string;
  advancePaid: number;
  balanceDue: number;
}

/** A prepaid preview is not the committed amount for cash-on-delivery. */
export function checkoutConfirmationAmounts(input: ConfirmationInput) {
  const isCod = input.paymentMethod === "cod";
  const discount = isCod ? 0 : input.isPartial
    ? Math.max(0, input.total - input.advancePaid - input.balanceDue)
    : Math.max(0, input.total - input.prepaidTotal);
  const total = Math.max(0, input.total - discount);
  return {
    discount,
    total,
    dueOnDelivery: isCod ? total : input.isPartial ? input.balanceDue : 0,
    paidNow: isCod ? 0 : input.isPartial ? input.advancePaid : total,
  };
}