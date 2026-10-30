import { describe, it, expect } from "vitest";
import { categoryPackagingSchema, selectedUtkalPackaging, utkalPackagingOptions } from "./categoryPackaging";
import { resolveCategoryPackaging, UTKAL_PACKAGING_STORE_ID } from "../../supabase/functions/_shared/categoryPackaging";
const saved = { id: "box-1", store_id: UTKAL_PACKAGING_STORE_ID, category_id: "category-1", label: "Gift box", image_url: "https://cdn.shopbanao.in/box.webp", surcharge: 150, is_active: true };
describe("category packaging", () => {
  it("replaces only the third choice with the saved name and price", () => {
    expect(utkalPackagingOptions(saved).map(o => [o.key, o.label, o.surcharge])).toEqual([["complimentary", "Complimentary Box", 0], ["signature", "Utkal Watch Box", 100], ["brandkit", "Gift box", 150]]);
  });
  it("retains the setting identity even for a free third box", () => {
    expect(selectedUtkalPackaging("brandkit", { ...saved, surcharge: 0 })).toMatchObject({ settingId: "box-1", surcharge: 0 });
  });
  it("makes the third choice unavailable without an active category box", () => {
    expect(selectedUtkalPackaging("brandkit", { ...saved, is_active: false }).key).toBe("complimentary");
  });
  it("charges the stored amount per unit, not shopper amounts", () => {
    const result = resolveCategoryPackaging(UTKAL_PACKAGING_STORE_ID, "brandkit", "box-1", saved);
    expect(result?.surcharge).toBe(150);
    expect((result?.surcharge ?? 0) * 2).toBe(300);
  });
  it("rejects another category or outdated setting identity", () => {
    expect(() => resolveCategoryPackaging(UTKAL_PACKAGING_STORE_ID, "brandkit", "other-box", saved)).toThrow();
  });
  it("does not affect other stores", () => {
    expect(resolveCategoryPackaging("another-store", "brandkit", "box-1", saved)).toBeNull();
  });
  it("rejects negative extra prices", () => {
    expect(categoryPackagingSchema.safeParse({ ...saved, category_id: "93c9f95e-d820-4404-b139-a29f4e2a7afe", surcharge: -1 }).success).toBe(false);
  });
});