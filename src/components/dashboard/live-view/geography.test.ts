import { describe, it, expect } from "vitest";
import { orderPoint, visitorPoint, countries } from "./geography";
describe("honest activity geography", () => {
  it("renders the complete world boundary dataset", () => { expect(countries.length).toBeGreaterThan(170); });
  it("matches a purchase city and state, not a guessed address", () => {
    const p = orderPoint("Mumbai", "Maharashtra", 3);
    expect(p?.lat).toBeCloseTo(19.07283, 2);
    expect(p?.count).toBe(3);
  });
  it("does not invent coordinates for unknown or ambiguous cities", () => {
    expect(orderPoint("unknown city", "Odisha", 1)).toBeNull();
    expect(orderPoint("Mumbai", "Odisha", 1)).toBeNull();
  });
  it("does not place missing visitor locations in India", () => {
    expect(visitorPoint(null, 4)).toBeNull();
    expect(visitorPoint("IN", 4)?.kind).toBe("visitor");
  });
});