import { describe, expect, it } from "vitest";
import { analyticsVisitorTitle } from "./analyticsMeasurement";

describe("visitor measurement accuracy", () => {
  it("does not represent daily archives as whole-range unique visitors", () => {
    expect(analyticsVisitorTitle("daily_aggregates")).toBe("Visitors (daily totals)");
  });
  it("identifies deduplicated raw measurements as unique", () => {
    expect(analyticsVisitorTitle("distinct")).toBe("Unique Visitors");
  });
});