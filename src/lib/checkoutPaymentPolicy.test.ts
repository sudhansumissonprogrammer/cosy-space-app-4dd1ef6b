import { describe, expect, it } from "vitest";
import { requiresCheckoutAdvance } from "../../supabase/functions/_shared/checkoutPaymentPolicy";
import { checkoutConfirmationAmounts } from "./checkoutConfirmationAmounts";

describe("Utkal optional advance policy", () => {
  it("allows full COD alongside the configured ₹100 advance only at Utkal", () => {
    expect(requiresCheckoutAdvance({ id: "ab19143d-87a9-490e-90b7-837313522782", partial_payment_enabled: true, partial_payment_value: 100 })).toBe(false);
    expect(requiresCheckoutAdvance({ id: "other-store", partial_payment_enabled: true, partial_payment_value: 100 })).toBe(true);
  });
  it("requires a positive enabled advance for other stores", () => {
    expect(requiresCheckoutAdvance({ id: "other-store", partial_payment_enabled: false, partial_payment_value: 100 })).toBe(false);
    expect(requiresCheckoutAdvance({ id: "other-store", partial_payment_enabled: true, partial_payment_value: 0 })).toBe(false);
  });
  it("COD after selecting partial still owes the full amount with no prepaid discount", () => {
    expect(checkoutConfirmationAmounts({ paymentMethod: "cod", total: 1499, prepaidTotal: 1399, isPartial: true, advancePaid: 100, balanceDue: 1399 })).toEqual({ discount: 0, total: 1499, dueOnDelivery: 1499, paidNow: 0 });
  });
  it("partial COD records ₹100 now and the remaining balance without prepaid discount", () => {
    expect(checkoutConfirmationAmounts({ paymentMethod: "payu", total: 1499, prepaidTotal: 1399, isPartial: true, advancePaid: 100, balanceDue: 1399 })).toEqual({ discount: 0, total: 1499, dueOnDelivery: 1399, paidNow: 100 });
  });
});