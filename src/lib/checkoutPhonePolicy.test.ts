import { describe, expect, it } from "vitest";
import { needsCheckoutPhoneScreen, checkoutAddressReady } from "./checkoutPhonePolicy";
const utkal = { id: "ab19143d-87a9-490e-90b7-837313522782" };
describe("Utkal direct checkout", () => {
  it("opens checkout without a phone screen for Utkal", () => { expect(needsCheckoutPhoneScreen(utkal, "")).toBe(false); });
  it("keeps the phone screen for other stores", () => { expect(needsCheckoutPhoneScreen({ id: "other" }, "")).toBe(true); });
  it("requires a valid phone as part of delivery details", () => {
    const fields = { phone: "", fullName: "Test", pincode: "751001", streetAddress: "Test address", city: "Bhubaneswar", state: "Odisha" };
    expect(checkoutAddressReady(fields)).toBe(false);
    expect(checkoutAddressReady({ ...fields, phone: "9692186366" })).toBe(true);
    expect(checkoutAddressReady({ ...fields, phone: "1234" })).toBe(false);
  });
});