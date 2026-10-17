import { describe, expect, it } from "vitest";
import { hidesCategoryFilters } from "./config";
import { KALINGA_STORE_ID } from "@/lib/kalingaStore";

describe("Kalinga category filtering isolation", () => {
  it("retains the hidden strips for the same store after renaming", () => {
    expect(hidesCategoryFilters({ id: KALINGA_STORE_ID, slug: "future-name" })).toBe(true);
  });
  it("does not hide another store's filters when it reuses the old slug", () => {
    expect(hidesCategoryFilters({ id: "another-store", slug: "imitationworld" })).toBe(false);
  });
});