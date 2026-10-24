import { describe, expect, it } from "vitest";
import { chooseMobileCardBuffer } from "./mobileCardReadiness";

describe("mobile storefront card budget", () => {
  it("keeps four visible cards and prepares only the next two, not the catalogue", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ item: i, top: Math.floor(i / 2) * 350, bottom: Math.floor(i / 2) * 350 + 340 }));
    expect(chooseMobileCardBuffer(rows, 700)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("advances the two-card buffer with scrolling", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ item: i, top: Math.floor(i / 2) * 350 - 700, bottom: Math.floor(i / 2) * 350 - 360 }));
    expect(chooseMobileCardBuffer(rows, 700)).toEqual([4, 5, 6, 7, 8, 9]);
  });
  it("does not prepare distant cards", () => {
    expect(chooseMobileCardBuffer([{ item: 1, top: 1200, bottom: 1540 }], 700)).toEqual([]);
  });
});