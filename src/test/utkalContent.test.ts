import { describe, it, expect } from "vitest";
import { isUtkalContentStore, isLegacyUtkalSnippet, utkalCollectionIntroduction, UTKAL_STORE_ID, UTKAL_STATUS, UTKAL_QUALITY_TERMS, UTKAL_SHOP_INTRO } from "../../supabase/functions/_shared/utkalContent";
import { productSearchDescription } from "../../supabase/functions/_shared/productSeo";

describe("factual Utkal content boundaries", () => {
  it("never applies Utkal context to another known store identity", () => {
    expect(isUtkalContentStore({ id: "other-store", slug: "utkalwatches" })).toBe(false);
    expect(isUtkalContentStore({ id: UTKAL_STORE_ID })).toBe(true);
    expect(utkalCollectionIntroduction({ id: "other-store" }, "men-s-watch")).toBeUndefined();
  });
  it("does not invent selection criteria for unreviewed brand categories", () => {
    expect(utkalCollectionIntroduction({ id: UTKAL_STORE_ID }, "hublot-new")).toBeUndefined();
  });
  it("recognizes the obsolete generated price and delivery campaign only", () => {
    expect(isLegacyUtkalSnippet("Analog watch for men at ₹1,650 on Utkal Watch. Cash on Delivery and fast delivery across India. Ideal for daily wear and gifting.")).toBe(true);
    expect(isLegacyUtkalSnippet("A merchant-approved watch description.")).toBe(false);
  });
  it("drops obsolete assertions without inventing watch functions", () => {
    const product = { name: "Listed Watch", meta_description: "Analog watch for men with chronograph at ₹1,650 on Utkal Watch. Cash on Delivery and fast delivery across India. Ideal for daily wear and gifting." };
    const result = productSearchDescription(product, "Utkal Watch");
    expect(result).not.toContain("₹1,650");
    expect(result).not.toContain("chronograph");
    expect(result).not.toContain("fast delivery");
  });
  it("preserves a separately approved product metadata override", () => {
    expect(productSearchDescription({ name: "Watch", meta_description: "Merchant-approved individual description" }, "Utkal Watch")).toBe("Merchant-approved individual description");
  });
  it("keeps shared storefront introductions compact", () => {
    expect(UTKAL_STATUS.length).toBeLessThanOrEqual(110);
    expect(UTKAL_STATUS).toContain("Cash on delivery");
    expect(UTKAL_STATUS).toContain("Rajkot");
    expect(UTKAL_SHOP_INTRO.length).toBeLessThanOrEqual(240);
    for (const slug of ["men-s-watch", "women-s-watch", "luxury-watch", "sale", "trending-products"]) {
      const intro = utkalCollectionIntroduction({ id: UTKAL_STORE_ID }, slug);
      expect(intro).toBeDefined();
      expect((intro || "").length).toBeLessThanOrEqual(100);
    }
  });
  it("retains the 1:1 inspired disclosure alongside the shorter copy", () => {
    expect(UTKAL_QUALITY_TERMS).toContain("1:1 inspired");
  });
});