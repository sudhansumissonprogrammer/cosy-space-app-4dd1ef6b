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
  const discount = input.isPartial || isCod ? 0 : Math.max(0, input.total - input.prepaidTotal);
  const total = Math.max(0, input.total - discount);
  return {
    discount,
    total,
    dueOnDelivery: input.isPartial ? input.balanceDue : isCod ? total : 0,
    paidNow: input.isPartial ? input.advancePaid : isCod ? 0 : total,
  };
}