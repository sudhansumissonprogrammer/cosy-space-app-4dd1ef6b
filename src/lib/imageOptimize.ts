/**
 * Optimizes external image URLs by appending width/quality params.
 * Supports Supabase Storage (render/image transform), Shopify CDN, Unsplash,
 * and falls back to an edge function proxy for arbitrary URLs.
 */

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";

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

  // Supabase Storage: use render/image transform API
  if (url.includes("supabase.co/storage")) {
    try {
      const u = new URL(url);
      // Transform /storage/v1/object/public/bucket/path
      // into     /storage/v1/render/image/public/bucket/path
      u.pathname = u.pathname.replace(
        "/storage/v1/object/",
        "/storage/v1/render/image/"
      );
      u.searchParams.set("width", String(width));
      u.searchParams.set("quality", "75");
      return u.toString();
    } catch {
      return url;
    }
  }

  // For any other external URL, proxy through our edge function
  if (SUPABASE_PROJECT_ID && (url.startsWith("http://") || url.startsWith("https://"))) {
    const proxyUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/image-resize?url=${encodeURIComponent(url)}&w=${width}&q=75`;
    return proxyUrl;
  }

  return url;
}

/** Extract the first URL from a potentially comma-separated image_url field */
export function cleanImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.includes(",") ? url.split(",")[0].trim() : url.trim();
}

/** Split a comma-separated image_url field into an array of individual URLs */
export function splitImageUrls(url: string | null | undefined): string[] {
  if (!url) return [];
  return url
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

/** Get a srcSet string for responsive images */
export function getImageSrcSet(url: string | null | undefined, sizes: number[] = [400, 600, 800]): string {
  if (!url) return "";
  return sizes.map((w) => `${optimizeImageUrl(url, w)} ${w}w`).join(", ");
}
