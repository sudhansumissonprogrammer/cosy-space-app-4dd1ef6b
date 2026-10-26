/** Public, factual store context; never derives technical specifications. */
export const UTKAL_STORE_ID = "ab19143d-87a9-490e-90b7-837313522782";
export function isUtkalContentStore(store: { id?: string | null; slug?: string | null }): boolean {
  return store.id ? store.id === UTKAL_STORE_ID : store.slug === "utkalwatches";
}
export const UTKAL_STATUS = "Men's and women's watches online in India. Cash on delivery; dispatch from our Rajkot store.";
export const UTKAL_QUALITY_TERMS = "Product features and specifications may vary by model. These are 1:1 inspired watches.";
export const UTKAL_HOME_HEADING = "Utkal Watches — Men's & Women's Watches Online in India";
export const UTKAL_SHOP_TITLE = "Shop Men's & Women's Watches Online | Utkal Watches";
export const UTKAL_SHOP_INTRO = "Compare listed prices and product photos across the full catalogue, then open a watch for its available details. " + UTKAL_STATUS;
const INTRODUCTIONS: Record<string, string> = {
  "men-s-watch": "Browse watches for men, compare listed prices and photos, then open a watch for its details.",
  "women-s-watch": "Browse watches for women, compare listed prices and photos, then open a watch for its details.",
  "luxury-watch": "Browse luxury-style watch designs and compare the listed photos and details of each item.",
  "sale": "Browse the sale collection and check each item's displayed price before ordering.",
  "trending-products": "Browse the trending collection and compare listed prices, photos and available details.",
};
export function utkalCollectionIntroduction(store: { id?: string | null; slug?: string | null }, categorySlug?: string | null): string | undefined {
  return isUtkalContentStore(store) && categorySlug ? INTRODUCTIONS[categorySlug] : undefined;
}

/** Recognize only the exact old generated campaign, preserving other overrides. */
export function isLegacyUtkalSnippet(text: string): boolean {
  return /^.+ at ₹[\d,]+ on Utkal Watches\. Cash on Delivery and fast delivery across India\.(?: Ideal for daily wear and gifting\.)?$/.test(text.trim());
}