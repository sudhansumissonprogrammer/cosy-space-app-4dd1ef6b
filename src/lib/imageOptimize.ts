/**
 * Image optimization utilities for multi-tenant storefronts.
 *
 * Priority: Cloudflare Polish/Resizing → Supabase render → Shopify/Unsplash CDN → proxy fallback.
 * All public images served through Cloudflare get automatic WebP/AVIF via Polish.
 */

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";

/**
 * Returns an optimised URL for a given image.
 * - For Supabase storage: uses /render/image/ transform API
 * - For Shopify/Unsplash CDNs: uses their native resize params
 * - For all other external URLs served through Cloudflare: uses /cdn-cgi/image/
 * - Fallback: edge-function proxy with caching
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  width: number = 400,
  quality: number = 75,
): string {
  if (!url) return "";

  // Handle comma-separated URLs — take only the first one
  const firstUrl = url.includes(",") ? url.split(",")[0].trim() : url.trim();
  if (!firstUrl) return "";
  url = firstUrl;

  // Shopify CDN
  if (url.includes("cdn/shop/") || url.includes("cdn.shopify.com")) {
    const u = new URL(url);
    u.searchParams.set("width", String(width));
    u.searchParams.set("format", "webp");
    return u.toString();
  }

  // Unsplash
  if (url.includes("images.unsplash.com")) {
    const u = new URL(url);
    u.searchParams.set("w", String(width));
    u.searchParams.set("q", String(quality));
    u.searchParams.set("fm", "webp");
    u.searchParams.set("auto", "format");
    return u.toString();
  }

  // Supabase Storage: use render/image transform API
  if (url.includes("supabase.co/storage")) {
    try {
      const u = new URL(url);
      u.pathname = u.pathname.replace(
        "/storage/v1/object/",
        "/storage/v1/render/image/",
      );
      u.searchParams.set("width", String(width));
      u.searchParams.set("quality", String(quality));
      return u.toString();
    } catch {
      return url;
    }
  }

  // External URL — try Cloudflare image resizing (works when site is behind CF)
  // Format: /cdn-cgi/image/width=W,quality=Q,format=auto/ORIGINAL_URL
  if (url.startsWith("https://") || url.startsWith("http://")) {
    try {
      const parsed = new URL(url);
      // If image is on our own domain (custom domain behind CF), use cdn-cgi
      // Otherwise fall back to edge function proxy
      if (SUPABASE_PROJECT_ID) {
        return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/image-resize?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
      }
    } catch {
      // Invalid URL, return as-is
    }
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

/**
 * Get a srcSet string for responsive images.
 * Default breakpoints tuned for product cards (mobile 2-col → desktop 4-col).
 */
export function getImageSrcSet(
  url: string | null | undefined,
  sizes: number[] = [300, 400, 600, 800],
  quality: number = 75,
): string {
  if (!url) return "";
  return sizes
    .map((w) => `${optimizeImageUrl(url, w, quality)} ${w}w`)
    .join(", ");
}

/**
 * Standard `sizes` attribute for product cards in a responsive grid.
 * Matches typical 2-col mobile / 3-col tablet / 4-col desktop layouts.
 */
export const PRODUCT_CARD_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

/**
 * Standard `sizes` attribute for hero/banner images (full-width).
 */
export const HERO_IMAGE_SIZES = "100vw";

/**
 * Injects a <link rel="preload"> for the LCP hero image into <head>.
 * Call once on mount for the first visible hero slide.
 * Returns a cleanup function to remove the link on unmount.
 */
export function preloadHeroImage(
  url: string | null | undefined,
  width: number = 800,
): (() => void) | undefined {
  if (!url) return undefined;
  const optimized = optimizeImageUrl(url, width, 75);
  if (!optimized) return undefined;

  // Avoid duplicate preloads
  const existing = document.querySelector(
    `link[rel="preload"][href="${optimized}"]`,
  );
  if (existing) return undefined;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = optimized;
  link.setAttribute("fetchpriority", "high");
  // Add srcset for responsive preload
  const srcSet = getImageSrcSet(url, [400, 600, 800, 1200], 75);
  if (srcSet) {
    link.setAttribute("imagesrcset", srcSet);
    link.setAttribute("imagesizes", HERO_IMAGE_SIZES);
  }
  document.head.appendChild(link);

  return () => {
    try {
      document.head.removeChild(link);
    } catch {
      // already removed
    }
  };
}
