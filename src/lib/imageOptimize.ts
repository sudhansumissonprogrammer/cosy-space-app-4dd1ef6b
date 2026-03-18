/**
 * Optimizes external image URLs by appending width/quality params.
 * Supports Shopify CDN, Unsplash, and generic URL patterns.
 */
export function optimizeImageUrl(url: string | null | undefined, width: number = 400): string {
  if (!url) return "";

  // Handle comma-separated URLs — take only the first one
  const firstUrl = url.includes(",") ? url.split(",")[0].trim() : url.trim();
  if (!firstUrl) return "";
  url = firstUrl;

  // Shopify CDN: append width param (e.g., &width=400)
  if (url.includes("cdn/shop/") || url.includes("cdn.shopify.com")) {
    const u = new URL(url);
    u.searchParams.set("width", String(width));
    return u.toString();
  }

  // Unsplash: use w= param
  if (url.includes("images.unsplash.com")) {
    const u = new URL(url);
    u.searchParams.set("w", String(width));
    u.searchParams.set("q", "80");
    u.searchParams.set("fm", "webp");
    return u.toString();
  }

  // Supabase Storage: use transform
  if (url.includes("supabase.co/storage")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}width=${width}&quality=80`;
  }

  return url;
}

/** Get a srcSet string for responsive images */
export function getImageSrcSet(url: string | null | undefined, sizes: number[] = [400, 600, 800]): string {
  if (!url) return "";
  return sizes.map((w) => `${optimizeImageUrl(url, w)} ${w}w`).join(", ");
}
