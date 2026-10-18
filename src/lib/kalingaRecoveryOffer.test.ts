import { describe, expect, it } from "vitest";
import { KALINGA_RECOVERY_STORE_ID as id, recoveryCouponToken, recoveryCouponTarget } from "../../supabase/functions/_shared/kalinga-recovery-offer";
describe("Kalinga abandoned-cart offer", () => {
  it("attaches SAVE100 only to Kalinga recovery tokens", () => {
    expect(recoveryCouponToken(`p-product~phone~${id}`, id, "SAVE100")).toBe(`p-product~phone~${id}~SAVE100`);
    expect(recoveryCouponToken("p-product", id, "SAVE50")).toBe("p-product");
    expect(recoveryCouponToken("p-product", "other-store", "SAVE100")).toBe("p-product");
  });
  it("carries SAVE100 into checkout visits while retaining existing query and fragment", () => {
    expect(recoveryCouponTarget("https://kalingajewels.com/product/test?wa=1#auth", id, "SAVE100")).toBe("https://kalingajewels.com/product/test?wa=1&coupon=SAVE100#auth");
    expect(recoveryCouponTarget("https://kalingajewels.com/product/test", id, "")).toBe("https://kalingajewels.com/product/test");
  });
});