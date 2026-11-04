import { describe, expect, it } from "vitest";
import { checkoutExitCoupon } from "./checkoutExitCoupon";
import { KALINGA_STORE_ID } from "./kalingaStore";
const store = { id: KALINGA_STORE_ID };
const save50 = { code: "SAVE50", discount_type: "flat", discount_value: 50 };
describe("Kalinga checkout exit offers", () => {
  it("offers SAVE50 for exactly ₹50 on a ₹699 item", () => {
    expect(checkoutExitCoupon(store, save50, 699)).toEqual({ code: "SAVE50", value: 50 });
  });
  it("never offers abandoned-cart SAVE100 on exit", () => {
    expect(checkoutExitCoupon(store, { ...save50, code: "SAVE100", discount_value: 100 }, 699)).toBeNull();
  });
  it("does not replace or stack an applied ₹100 recovery discount", () => {
    expect(checkoutExitCoupon(store, save50, 699, "SAVE100", 100)).toBeNull();
  });
  it("does not offer the already claimed SAVE50 again", () => {
    expect(checkoutExitCoupon(store, save50, 699, "SAVE50", 50)).toBeNull();
  });
  it("rejects a changed SAVE50 amount", () => {
    expect(checkoutExitCoupon(store, { ...save50, discount_value: 100 }, 699)).toBeNull();
  });
  it("respects coupon minimum, validity and usage limits", () => {
    expect(checkoutExitCoupon(store, { ...save50, min_order_amount: 999 }, 699)).toBeNull();
    expect(checkoutExitCoupon(store, { ...save50, expires_at: "2026-10-17T00:00:00Z" }, 699, null, 0, Date.parse("2026-10-18T00:00:00Z"))).toBeNull();
    expect(checkoutExitCoupon(store, { ...save50, max_uses: 1, used_count: 1 }, 699)).toBeNull();
    expect(checkoutExitCoupon(store, { ...save50, is_active: false }, 699)).toBeNull();
  });
  it("preserves Serdiya's ₹100 exit offer", () => {
    expect(checkoutExitCoupon({ id: "771a3012-393c-421a-b1c9-2ca918e6917f" }, { ...save50, code: "FLAT100", discount_value: 100 }, 699)).toEqual({ code: "FLAT100", value: 100 });
  });
  it("Utkal exit offers SAVE50 ₹50, never the ₹100 WhatsApp coupon", () => {
    const utkal = { id: "ab19143d-87a9-490e-90b7-837313522782" };
    expect(checkoutExitCoupon(utkal, save50, 1499)).toEqual({ code: "SAVE50", value: 50 });
    expect(checkoutExitCoupon(utkal, { ...save50, code: "FLAT100", discount_value: 100 }, 1499)).toBeNull();
  });
});
