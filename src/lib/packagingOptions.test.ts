import { describe, expect, it } from "vitest";
import { packagingVisibleForProduct, UTKAL_PACKAGING_OPTIONS, packagingSurcharge } from "./packagingOptions";

describe("Utkal packaging", () => {
  it("shows on every Utkal product without category membership", () => {
    expect(packagingVisibleForProduct(true, false, false)).toBe(true);
  });
  it("preserves category eligibility for other stores", () => {
    expect(packagingVisibleForProduct(false, true, false)).toBe(false);
    expect(packagingVisibleForProduct(false, true, true)).toBe(true);
    expect(packagingVisibleForProduct(false, false, true)).toBe(false);
  });
  it("keeps three choices and prevents selecting the unavailable third box", () => {
    expect(UTKAL_PACKAGING_OPTIONS).toHaveLength(3);
    expect(UTKAL_PACKAGING_OPTIONS.filter(option => !option.unavailable).map(option => option.key)).toEqual(["complimentary", "signature"]);
    expect(packagingSurcharge("complimentary")).toBe(0);
    expect(packagingSurcharge("signature")).toBe(100);
  });
});