import { describe, it, expect } from "vitest";
import { analyticsRange } from "./analyticsRange";
describe("store-local analytics ranges", () => {
  const now = new Date("2026-10-31T15:09:00Z");
  it("includes exactly 30 calendar days in India", () => {
    const r = analyticsRange("30d", now);
    expect(r.rangeStart.toISOString()).toBe("2026-10-01T18:30:00.000Z");
    expect(r.priorEnd.getTime()).toBe(r.rangeStart.getTime());
  });
  it("includes exactly 90 calendar days", () => {
    expect(analyticsRange("90d", now).rangeStart.toISOString()).toBe("2026-08-02T18:30:00.000Z");
  });
  it("compares a one-day custom range with one prior day", () => {
    const r = analyticsRange("custom", now, "Asia/Kolkata", new Date(2026, 9, 10), new Date(2026, 9, 10));
    expect(r.rangeStart.getTime() - r.priorStart.getTime()).toBe(86400000);
    expect(r.rangeEnd.getTime() - r.rangeStart.getTime()).toBe(86400000 - 1);
  });
});