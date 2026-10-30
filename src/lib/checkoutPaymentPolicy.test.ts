import { describe, expect, it } from "vitest";
import { requiresCheckoutAdvance, utkalPartialDiscount } from "../../supabase/functions/_shared/checkoutPaymentPolicy";
import { checkoutConfirmationAmounts } from "./checkoutConfirmationAmounts";
import { allowsFullPrepaid, utkalPartialDiscount as clientUtkalPartialDiscount } from "./utkalCheckoutHints";
import { checkoutPartialAmounts } from "./checkoutPartialAmounts";

describe("Utkal optional advance policy", () => {
  it("disables full prepaid only for Utkal Watch by persisted ID or legacy slug", () => {
    expect(allowsFullPrepaid({ id: "ab19143d-87a9-490e-90b7-837313522782" })).toBe(false);
    expect(allowsFullPrepaid({ slug: "utkalwatches" })).toBe(false);
    expect(allowsFullPrepaid({ id: "other-store" })).toBe(true);
  });
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
  it("gives a flat ₹50 partial discount only at Utkal, on server and client", () => {
    expect(utkalPartialDiscount("ab19143d-87a9-490e-90b7-837313522782")).toBe(50);
    expect(utkalPartialDiscount("other-store")).toBe(0);
    expect(utkalPartialDiscount(null)).toBe(0);
    expect(clientUtkalPartialDiscount({ id: "ab19143d-87a9-490e-90b7-837313522782" })).toBe(50);
    expect(clientUtkalPartialDiscount({ slug: "utkalwatches" })).toBe(50);
    expect(clientUtkalPartialDiscount({ id: "other-store" })).toBe(0);
  });
  it("the ₹50 partial discount reduces only the delivery balance, never the advance", () => {
    // ₹1,499 watch: ₹100 advance, balance ₹1,499 − ₹100 − ₹50 = ₹1,349.
    expect(checkoutConfirmationAmounts({ paymentMethod: "payu", total: 1499, prepaidTotal: 1499, isPartial: true, advancePaid: 100, balanceDue: 1349 })).toEqual({ discount: 50, total: 1449, dueOnDelivery: 1349, paidNow: 100 });
    expect(checkoutPartialAmounts(1499, 100, 50)).toEqual({ discount: 50, total: 1449, balance: 1349 });
  });
  it("retains other stores' configured advance and undiscounted delivery balance", () => {
    expect(checkoutPartialAmounts(1499, 300, clientUtkalPartialDiscount({ id: "other-store" }))).toEqual({ discount: 0, total: 1499, balance: 1199 });
  });
  it("cannot advertise a discount larger than the remaining delivery balance", () => {
    expect(checkoutPartialAmounts(120, 100, 50)).toEqual({ discount: 20, total: 100, balance: 0 });
    expect(checkoutPartialAmounts(100, 100, 50)).toEqual({ discount: 0, total: 100, balance: 0 });
  });
});