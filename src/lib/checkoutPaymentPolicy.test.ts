import { describe, expect, it } from "vitest";
import { requiresCheckoutAdvance } from "../../supabase/functions/_shared/checkoutPaymentPolicy";
import { checkoutConfirmationAmounts } from "./checkoutConfirmationAmounts";
import { checkoutPartialAmounts } from "./checkoutPartialAmounts";

describe("Dashboard-controlled checkout payment policy", () => {
  it("requires the configured advance at Utkal just like other stores, excluding standalone COD", () => {
    expect(requiresCheckoutAdvance({ id: "ab19143d-87a9-490e-90b7-837313522782", partial_payment_enabled: true, partial_payment_value: 100 })).toBe(true);
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
  it("Utkal partial COD has no extra discount: ₹1499 equals ₹100 advance plus ₹1399 delivery balance", () => {
    expect(checkoutPartialAmounts(1499, 100, 0)).toEqual({ discount: 0, total: 1499, balance: 1399 });
    expect(checkoutConfirmationAmounts({ paymentMethod: "payu", total: 1499, prepaidTotal: 1399, isPartial: true, advancePaid: 100, balanceDue: 1399 })).toEqual({ discount: 0, total: 1499, dueOnDelivery: 1399, paidNow: 100 });
  });
  it("Utkal respects dashboard changes to the required advance", () => {
    expect(requiresCheckoutAdvance({ id: "ab19143d-87a9-490e-90b7-837313522782", partial_payment_enabled: false, partial_payment_value: 100 })).toBe(false);
    expect(requiresCheckoutAdvance({ id: "ab19143d-87a9-490e-90b7-837313522782", partial_payment_enabled: true, partial_payment_value: 0 })).toBe(false);
    expect(checkoutPartialAmounts(1499, 300, 0)).toEqual({ discount: 0, total: 1499, balance: 1199 });
  });
  it("full online payment retains the dashboard's full-prepaid discount", () => {
    expect(checkoutConfirmationAmounts({ paymentMethod: "payu", total: 1499, prepaidTotal: 1399, isPartial: false, advancePaid: 0, balanceDue: 0 })).toEqual({ discount: 100, total: 1399, dueOnDelivery: 0, paidNow: 1399 });
  });
  it("retains other stores' configured advance and undiscounted delivery balance", () => {
    expect(checkoutPartialAmounts(1499, 300, 0)).toEqual({ discount: 0, total: 1499, balance: 1199 });
  });
  it("cannot advertise a discount larger than the remaining delivery balance", () => {
    expect(checkoutPartialAmounts(120, 100, 100)).toEqual({ discount: 20, total: 100, balance: 0 });
    expect(checkoutPartialAmounts(100, 100, 100)).toEqual({ discount: 0, total: 100, balance: 0 });
  });
});