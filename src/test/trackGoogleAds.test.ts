import { describe, it, expect, beforeEach } from "vitest";
import { fireGoogleAdsPurchase, ensureGoogleAdsTag } from "@/lib/trackGoogleAds";

// jsdom runs on localhost — the module treats that as non-production and
// no-ops. Force a production hostname so the tracking logic itself is tested.
function setProductionHost() {
  Object.defineProperty(window, "location", {
    value: new URL("https://kalingajewels.com/checkout"),
    writable: true,
    configurable: true,
  });
}

describe("trackGoogleAds", () => {
  beforeEach(() => {
    setProductionHost();
    localStorage.clear();
    delete window.gtag;
    delete window.dataLayer;
    delete window.__SF_GADS_INITED__;
  });

  it("configures the Google tag with the store's AW- id", () => {
    ensureGoogleAdsTag("AW-123456789");
    expect(typeof window.gtag).toBe("function");
    const configCalls = window.dataLayer!.filter(
      (args) => args[0] === "config" && args[1] === "AW-123456789",
    );
    expect(configCalls).toHaveLength(1);
  });

  it("is a no-op without an ads id or purchase label", () => {
    fireGoogleAdsPurchase({ adsId: null, purchaseLabel: "lbl", orderId: "o1", value: 699, currency: "INR" });
    fireGoogleAdsPurchase({ adsId: "AW-123456789", purchaseLabel: null, orderId: "o1", value: 699, currency: "INR" });
    expect(window.dataLayer ?? []).toHaveLength(0);
  });

  it("fires purchase once per order with transaction_id, value and currency", () => {
    fireGoogleAdsPurchase({ adsId: "AW-123456789", purchaseLabel: "abcXYZ", orderId: "order-1", value: 699, currency: "INR" });
    fireGoogleAdsPurchase({ adsId: "AW-123456789", purchaseLabel: "abcXYZ", orderId: "order-1", value: 699, currency: "INR" });

    const conversions = window.dataLayer!.filter((args) => args[0] === "event" && args[1] === "conversion");
    expect(conversions).toHaveLength(1);
    expect(conversions[0][2]).toMatchObject({
      send_to: "AW-123456789/abcXYZ",
      value: 699,
      currency: "INR",
      transaction_id: "order-1",
    });
  });

  it("fires again for a different order id", () => {
    fireGoogleAdsPurchase({ adsId: "AW-123456789", purchaseLabel: "abcXYZ", orderId: "order-1", value: 699, currency: "INR" });
    fireGoogleAdsPurchase({ adsId: "AW-123456789", purchaseLabel: "abcXYZ", orderId: "order-2", value: 999, currency: "INR" });
    const conversions = window.dataLayer!.filter((args) => args[0] === "event" && args[1] === "conversion");
    expect(conversions).toHaveLength(2);
  });
});
