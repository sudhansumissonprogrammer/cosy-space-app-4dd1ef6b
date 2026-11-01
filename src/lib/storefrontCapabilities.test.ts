import { describe, expect, it } from "vitest";
import { hasStorefrontApp, needsGiftReconciliation } from "./storefrontCapabilities";

describe("optional storefront code gates", () => {
  it("does not load storefront-app UI for unrelated or absent apps", () => {
    expect(hasStorefrontApp([])).toBe(false);
    expect(hasStorefrontApp([{ app_id: "shop-by-video", config: {} }])).toBe(false);
    expect(hasStorefrontApp([{ app_id: "spin-wheel", config: {} }])).toBe(true);
  });
  it("skips gift implementation for empty carts and unavailable offers", () => {
    const apps = [{ app_id: "upsell-crosssell", config: { offers: [{ active: true, incentive: { type: "free_gift" }, trigger: { type: "cart_value" } }] } }];
    expect(needsGiftReconciliation(apps, [])).toBe(false);
    expect(needsGiftReconciliation([], [{}])).toBe(false);
    expect(needsGiftReconciliation(apps, [{}])).toBe(true);
  });
  it("keeps stale gift cleanup mounted after an app is disabled", () => {
    expect(needsGiftReconciliation([], [{ meta: { auto_gift: true } }])).toBe(true);
  });
});