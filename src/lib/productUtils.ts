/**
 * Shared product utilities — eliminates duplication across 7+ product card components.
 */

/** Deterministic rating from product ID (consistent across renders) */
export function getProductRating(productId: string): number {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const ratings = [4.2, 4.3, 4.4, 4.5, 4.5, 4.6, 4.6, 4.7, 4.8, 4.9];
  return ratings[Math.abs(hash) % ratings.length];
}

/** Get effective price (sale or regular) */
export function getEffectivePrice(price: number, salePrice?: number | null): number {
  return salePrice && salePrice < price ? Number(salePrice) : Number(price);
}

/** Calculate discount percentage (null if no discount) */
export function getDiscountPercent(price: number, salePrice?: number | null): number | null {
  if (!salePrice || salePrice >= price) return null;
  return Math.round(((Number(price) - Number(salePrice)) / Number(price)) * 100);
}

/** Format price with currency symbol and Indian locale */
export function formatPrice(amount: number, currency?: string): string {
  const symbol = !currency || currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
  return `${symbol}${Number(amount).toLocaleString("en-IN", { useGrouping: false })}`;
}

/** Deterministic social proof stats from product ID (for ProductDetail page) */
export function getProductStats(productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  return {
    rating: getProductRating(productId),
    reviewCount: 30 + (abs % 170),
    viewingNow: 3 + (abs % 15),
    soldThisWeek: 10 + (abs % 90),
  };
}

/** Map a currency code (or symbol) to its display symbol. Always use this for UI. */
export function currencySymbol(currency?: string | null): string {
  if (!currency) return "₹";
  const c = String(currency).trim().toUpperCase();
  const map: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", AUD: "A$", CAD: "C$" };
  return map[c] || currency;
}
