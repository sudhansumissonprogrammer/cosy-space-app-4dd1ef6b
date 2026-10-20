import { describe, expect, it } from "vitest";
import { kalingaCouponPrice } from "./kalingaCouponPreview";
import { KALINGA_STORE_ID } from "./kalingaStore";

describe("Kalinga SAVE100 price preview", () => {
  it("shows ₹599 for a ₹699 product with SAVE100", () => {
    expect(kalingaCouponPrice(KALINGA_STORE_ID, "save100", 699)).toBe(599);
  });
  it("does nothing without the coupon or for other stores", () => {
    expect(kalingaCouponPrice(KALINGA_STORE_ID, null, 699)).toBeNull();
    expect(kalingaCouponPrice(KALINGA_STORE_ID, "SAVE50", 699)).toBeNull();
    expect(kalingaCouponPrice("other", "SAVE100", 699)).toBeNull();
  });
});
