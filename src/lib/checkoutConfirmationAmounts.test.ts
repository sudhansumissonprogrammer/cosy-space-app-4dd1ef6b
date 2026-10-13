import { describe, expect, it } from "vitest";
import { checkoutConfirmationAmounts } from "./checkoutConfirmationAmounts";

const base = { total: 699, prepaidTotal: 629, isPartial: false, advancePaid: 0, balanceDue: 0 };

describe("checkout confirmation payment rules", () => {
  it("never applies the prepaid discount to COD", () => {
    expect(checkoutConfirmationAmounts({ ...base, paymentMethod: "cod" })).toEqual({
      discount: 0, total: 699, dueOnDelivery: 699, paidNow: 0,
    });
  });
  it("retains the configured ₹70 discount for full online payment", () => {
    expect(checkoutConfirmationAmounts({ ...base, paymentMethod: "payu" })).toEqual({
      discount: 70, total: 629, dueOnDelivery: 0, paidNow: 629,
    });
  });
  it("retains the undiscounted total and actual advance on partial payment", () => {
    expect(checkoutConfirmationAmounts({ ...base, paymentMethod: "payu", isPartial: true, advancePaid: 100, balanceDue: 599 })).toEqual({
      discount: 0, total: 699, dueOnDelivery: 599, paidNow: 100,
    });
  });
});