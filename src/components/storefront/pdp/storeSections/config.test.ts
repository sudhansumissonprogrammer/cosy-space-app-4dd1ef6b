import { describe, expect, it } from "vitest";
import { hidesCategoryFilters } from "./config";
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

describe("unverified Utkal catalogue assurances", () => {
  it("does not apply generic assurance sections to Utkal products", () => {
    for (const slot of ["under-gallery", "under-price", "after-related"] as const) {
      expect(WristlifeSections({ slot, product: {}, store: { id: UTKAL_STORE_ID } })).toBeNull();
      expect(WristlifeSections({ slot, product: {}, store: { id: "another-store" } })).not.toBeNull();
    }
  });
});