import { describe, expect, it } from "vitest";
import { trackingAvailability, trackingUnavailableMessage } from "./trackingAvailability";

describe("shipment tracking availability", () => {
  it("recognises the India Post captcha and empty fallback outage", () => {
    expect(trackingAvailability("portal: captcha_required | 17track: no scans yet"))
      .toBe("temporarily_unavailable");
  });

  it("keeps successful tracking live", () => {
    expect(trackingAvailability(null)).toBe("live");
  });

  it("explains whether cached courier scans remain visible", () => {
    expect(trackingUnavailableMessage(true)).toContain("last confirmed scans");
    expect(trackingUnavailableMessage(false)).toContain("official courier tracking");
  });
});