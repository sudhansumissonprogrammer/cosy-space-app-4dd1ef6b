import { describe, expect, it } from "vitest";
import { checkoutCashback } from "./checkoutCashback";
import { KALINGA_STORE_ID } from "./kalingaStore";

describe("payment cashback amount", () => {
  it("shows ₹50 for Kalinga full payment", () => {
    expect(checkoutCashback({ id: KALINGA_STORE_ID }, false)).toBe(50);
  });
  it("keeps ₹50 for Kalinga partial payment", () => {
    expect(checkoutCashback({ id: KALINGA_STORE_ID }, true)).toBe(50);
  });
  it("preserves other stores' full and partial amounts", () => {
    expect(checkoutCashback({ id: "other-store" }, false)).toBe(100);
    expect(checkoutCashback({ id: "other-store" }, true)).toBe(50);
  });
});