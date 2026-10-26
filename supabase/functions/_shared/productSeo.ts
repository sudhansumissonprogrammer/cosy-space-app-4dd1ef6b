import { isLegacyUtkalSnippet } from "./utkalContent";
/** Search metadata only: never rewrites merchant facts or purchasing rules. */
export function productSearchDescription(product: { name: string; meta_description?: string | null; description?: string | null }, storeName: string): string {
  if (storeName === "Utkal Watches" && isLegacyUtkalSnippet(product.meta_description || "")) {
    return "View this listed first copy / replica watch at Utkal Watches. Not a genuine branded product; compare its photographs and confirm individual details.";
  }
  return product.meta_description?.trim() || product.description?.trim().slice(0, 160) || `View ${product.name} at ${storeName}.`;
}

/** Match the existing PDP's displayed parent price, including its zero-sale convention. */
export function productSearchPrice(product: { price: number; sale_price?: number | null }): number {
  return product.sale_price && product.sale_price < product.price ? product.sale_price : product.price;
}