import { describe, expect, it } from "vitest";
import { kalingaCodPrepaidHint, kalingaUpiDeliveryHint } from "./kalingaCheckoutHints";
import { KALINGA_STORE_ID } from "./kalingaStore";

describe("Kalinga checkout delivery hints", () => {
  it("shows the 3-day note under Kalinga's UPI price", () => {
    expect(kalingaUpiDeliveryHint({ id: KALINGA_STORE_ID })).toBe("Fast delivery under 3 days");
  });
  it("shows the prepaid nudge on Kalinga's cash-on-delivery button", () => {
    expect(kalingaCodPrepaidHint({ id: KALINGA_STORE_ID })).toBe(
      "70% of our customers choose prepaid — get discount & faster delivery",
    );
  });
  it("keeps both notes off every other store", () => {
    expect(kalingaUpiDeliveryHint({ id: "771a3012-393c-421a-b1c9-2ca918e6917f" })).toBeNull();
    expect(kalingaCodPrepaidHint({ id: "771a3012-393c-421a-b1c9-2ca918e6917f" })).toBeNull();
    expect(kalingaUpiDeliveryHint(null)).toBeNull();
    expect(kalingaCodPrepaidHint(undefined)).toBeNull();
  });
  it("still resolves the legacy slug to Kalinga", () => {
    expect(kalingaUpiDeliveryHint({ slug: "kalingajewels" })).toBe("Fast delivery under 3 days");
    expect(kalingaCodPrepaidHint({ slug: "imitationworld" })).toContain("70% of our customers");
  });
});
