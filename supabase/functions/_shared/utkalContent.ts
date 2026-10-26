/** Public, factual store context; never derives technical specifications. */
export const UTKAL_STORE_ID = "ab19143d-87a9-490e-90b7-837313522782";
export function isUtkalContentStore(store: { id?: string | null; slug?: string | null }): boolean {
  return store.id ? store.id === UTKAL_STORE_ID : store.slug === "utkalwatches";
}
export const UTKAL_STATUS = "These are first copy / replica watches, not genuine products of the brands they resemble. Brand and model references describe the listed design, not manufacture or authorization by that brand.";
export const UTKAL_QUALITY_TERMS = "Terms such as clone, 7A, AAA, premium and 1:1 are seller descriptions, not independently verified quality certifications. Movement, working functions, materials and water resistance require confirmation for the individual watch; specifications of a genuine model do not verify this replica.";
export const UTKAL_HOME_HEADING = "Utkal Watches — First Copy & Replica Watches in India";
export const UTKAL_SHOP_TITLE = "Browse First Copy & Replica Watches | Utkal Watches";
export const UTKAL_SHOP_INTRO = "Browse the Utkal Watches catalogue, compare current listed prices and product photos, and open an individual watch for its available details. Use the men's and women's collections to narrow your selection. These are replica watches, not genuine branded products.";
const INTRODUCTIONS: Record<string, string> = {
  "men-s-watch": "Browse first copy watches for men in this collection. Compare the photographs and current listed prices, then open the watch you are considering for its available details. Confirm fit, movement and working functions for the individual item rather than assuming specifications from its model name.",
  "women-s-watch": "Explore first copy watches for women and compare the designs shown in this collection. Check each item's photos, current listed price and available description. Confirm dimensions, strap fit and any material or movement details before choosing a watch.",
  "luxury-watch": "Explore luxury-style replica watch designs, not genuine luxury-brand products. Compare the actual photographs and listed details of each item. A familiar model name, decorative subdial or premium label does not verify its movement, materials or working functions.",
  "sale": "Browse watches currently assigned to the Utkal Watches sale collection. Check each item's displayed selling price and any listed comparison price before ordering; inclusion in this collection is not a lowest-price guarantee. Review the individual replica watch's photos and available details.",
  "trending-products": "Explore the watches selected for the Utkal Watches Trending Products collection. This is a store-curated selection, not a verified sales ranking. Compare current listed prices, product photographs and available details to choose a replica-watch design.",
};
export function utkalCollectionIntroduction(store: { id?: string | null; slug?: string | null }, categorySlug?: string | null): string | undefined {
  return isUtkalContentStore(store) && categorySlug ? INTRODUCTIONS[categorySlug] : undefined;
}

/** Recognize only the exact old generated campaign, preserving other overrides. */
export function isLegacyUtkalSnippet(text: string): boolean {
  return /^.+ at ₹[\d,]+ on Utkal Watches\. Cash on Delivery and fast delivery across India\.(?: Ideal for daily wear and gifting\.)?$/.test(text.trim());
}