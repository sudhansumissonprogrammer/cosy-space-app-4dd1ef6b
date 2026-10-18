import { describe, expect, it } from "vitest";
import { customerTrackingUrl, validShipmentTrackingNumber } from "../../../supabase/functions/_shared/customer-tracking";
import { COURIERS, officialTrackingUrl } from "./courierRegistry";

describe("manual shipment tracking", () => {
  it("links Valmo shipments directly to official tracking", () => {
    expect(customerTrackingUrl("valmo", " VL0123456789012 ")).toBe("https://www.valmo.in/track/VL0123456789012");
    expect(officialTrackingUrl("valmo", "VL0123456789012")).toBe("https://www.valmo.in/track/VL0123456789012");
  });
  it("keeps existing non-Valmo customer destinations", () => {
    const url = new URL(customerTrackingUrl("india_post", "EE123456789IN"));
    expect(url.hostname).toBe("speedposttrack.io");
    expect(JSON.parse(atob(url.searchParams.get("d") ?? ""))).toEqual({ t: "EE123456789IN", c: "speedpost" });
  });
  it("offers Valmo without claiming automatic tracking sync", () => {
    expect(COURIERS.find((courier) => courier.slug === "valmo")).toMatchObject({ name: "Valmo", api: false });
  });
  it("allows valid manually entered tracking numbers without any photo", () => {
    expect(validShipmentTrackingNumber(" VL0123456789012 ")).toBe(true);
    expect(validShipmentTrackingNumber("EE123456789IN")).toBe(true);
  });
  it("rejects malformed and out-of-range tracking numbers", () => {
    for (const value of ["", "ABC", "VL 12345", "https://valmo.in/track", "A".repeat(41)]) {
      expect(validShipmentTrackingNumber(value)).toBe(false);
    }
  });
});