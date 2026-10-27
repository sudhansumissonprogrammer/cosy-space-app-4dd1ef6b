import { describe, expect, it } from "vitest";
import { hasCustomPdpSections, hidesCategoryFilters } from "./config";
import { KALINGA_STORE_ID } from "@/lib/kalingaStore";
import WristlifeSections from "./WristlifeSections";
import { UTKAL_STORE_ID } from "../../../../../supabase/functions/_shared/utkalContent";

describe("Kalinga category filtering isolation", () => {
  it("retains the hidden strips for the same store after renaming", () => {
    expect(hidesCategoryFilters({ id: KALINGA_STORE_ID, slug: "future-name" })).toBe(true);
  });
  it("does not hide another store's filters when it reuses the old slug", () => {
    expect(hidesCategoryFilters({ id: "another-store", slug: "imitationworld" })).toBe(false);
  });
});

describe("Utkal merchant custom sections", () => {
  it("retains all three custom slots for the Utkal store after renaming", () => {
    const store = { id: UTKAL_STORE_ID, slug: "future-name" };
    expect(hasCustomPdpSections(store)).toBe(true);
    for (const slot of ["under-gallery", "under-price", "after-related"] as const) {
      expect(WristlifeSections({ slot, product: {}, store })).not.toBeNull();
    }
  });
  it("keeps custom sections gated away from unrelated stores", () => {
    expect(hasCustomPdpSections({ id: "another-store", slug: "another-store" })).toBe(false);
  });
});