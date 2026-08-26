/**
 * Build the supplier (source store) product page URL for a synced product.
 *
 * Two supported source platforms today:
 *   • cartpe    → {store.source_base_url}/{product.source_path}
 *   • jdwebship → {base}/products/{product.slug}   (their slug == ours)
 */

export const DEFAULT_SOURCE_BASE: Record<string, string> = {
  jdwebship: "https://shodfedf.jdwebshop.com",
};

export type SourceStore = {
  source_platform?: string | null;
  source_base_url?: string | null;
} | null | undefined;

export type SourceProduct = {
  slug?: string | null;
  source_path?: string | null;
  source_id?: string | null;
  source_platform?: string | null;
} | null | undefined;

const trimEnd = (s: string) => s.replace(/\/+$/, "");
const trimStart = (s: string) => s.replace(/^\/+/, "");

export function buildSourcePdpUrl(store: SourceStore, product: SourceProduct): string | null {
  if (!product) return null;
  const platform = product.source_platform || store?.source_platform || null;
  if (!platform) return null;

  // Mirrored products (imported from another of our stores) carry the FULL
  // supplier URL in source_path, because their own store has no matching
  // source_base_url. Use it verbatim.
  if (product.source_path && /^https?:\/\//i.test(product.source_path)) return product.source_path;

  const base = trimEnd(store?.source_base_url || DEFAULT_SOURCE_BASE[platform] || "");
  if (!base) return null;

  if (product.source_path) return `${base}/${trimStart(product.source_path)}`;


  if (platform === "jdwebship" && product.slug) {
    return `${base}/products/${product.slug}`;
  }

  return null;
}

export function sourceLabel(platform?: string | null): string {
  if (platform === "jdwebship") return "JD supplier";
  if (platform === "cartpe") return "Cartpe supplier";
  return "Supplier";
}
