/** Public, factual store context; never derives technical specifications. */
export const UTKAL_STORE_ID = "ab19143d-87a9-490e-90b7-837313522782";
export function isUtkalContentStore(store: { id?: string | null; slug?: string | null }): boolean {
  return store.id ? store.id === UTKAL_STORE_ID : store.slug === "utkalwatches";
}
export const UTKAL_STATUS = "Shop stylish men's and women's watches online in India at Utkal Watches, with cash on delivery and dispatch from our Rajkot store. Not genuine or affiliated with the brands shown.";
export const UTKAL_QUALITY_TERMS = "Product features and specifications may vary by model.";
export const UTKAL_HOME_HEADING = "Utkal Watches — Men's & Women's Watches Online in India";
export const UTKAL_SHOP_TITLE = "Shop Men's & Women's Watches Online | Utkal Watches";
export const UTKAL_SHOP_INTRO = "Browse the Utkal Watches catalogue, compare current listed prices and product photos, and open an individual watch for its available details. Use the men's and women's collections to narrow your selection. " + UTKAL_STATUS;
const INTRODUCTIONS: Record<string, string> = {
  "men-s-watch": "Browse watches for men in this collection. Compare the photographs and current listed prices, then open the watch you are considering for its available details.",
  "women-s-watch": "Explore watches for women and compare the designs shown in this collection. Check each item's photos, current listed price and available description.",
  "luxury-watch": "Explore luxury-style watch designs. Compare the actual photographs and listed details of each item; features can vary by model.",
  "sale": "Browse watches currently assigned to the Utkal Watches sale collection. Check each item's displayed selling price and any listed comparison price before ordering.",
  "trending-products": "Explore the watches selected for the Utkal Watches Trending Products collection. Compare current listed prices, product photographs and available details.",
};
export function utkalCollectionIntroduction(store: { id?: string | null; slug?: string | null }, categorySlug?: string | null): string | undefined {
  return isUtkalContentStore(store) && categorySlug ? INTRODUCTIONS[categorySlug] : undefined;
}

/** Recognize only the exact old generated campaign, preserving other overrides. */
export function isLegacyUtkalSnippet(text: string): boolean {
  return /^.+ at ₹[\d,]+ on Utkal Watches\. Cash on Delivery and fast delivery across India\.(?: Ideal for daily wear and gifting\.)?$/.test(text.trim());
}