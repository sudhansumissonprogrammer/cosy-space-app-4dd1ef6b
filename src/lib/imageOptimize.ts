/**
 * Image optimization utilities for multi-tenant storefronts.
 *
 * Priority order:
 *  1. Our own pipeline variants (basePath-200w.webp, -400w.webp, -800w.webp)
 *  2. Supabase render/image transform API
 *  3. Shopify / Unsplash CDN params
 *  4. Edge function proxy fallback
 *
 * All public images served through Cloudflare get automatic WebP/AVIF via Polish.
 */

import { isOptimizedUrl, resolveVariantUrl } from "./uploadOptimizedImage";
import type { VariantWidth } from "./imageCompression";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";

/** Origins that sit behind Cloudflare and support /cdn-cgi/image/ transforms */
const CF_IMAGE_ORIGINS = ["storivo.in", "supabase.co"];

/**
 * Check if a URL is served through a Cloudflare-proxied origin that supports
 * the /cdn-cgi/image/ transformation pipeline.
 */
function isCfImageEligible(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return CF_IMAGE_ORIGINS.some((o) => hostname.endsWith(o));
  } catch {
    return false;
  }
}

/**
 * Build a Cloudflare Image Resizing URL.
 * Docs: https://developers.cloudflare.com/images/transform-images/transform-via-url/
 */
function cfImageUrl(
  originUrl: string,
  width: number,
  quality: number,
): string {
  // /cdn-cgi/image/width=W,quality=Q,format=auto/FULL_ORIGINAL_URL
  return `/cdn-cgi/image/width=${width},quality=${quality},format=auto,fit=scale-down/${originUrl}`;
}

/** Standard widths for srcSet that match our stored variants */
const PIPELINE_WIDTHS: VariantWidth[] = [200, 400, 800];

/**
 * Returns an optimised URL for a given image.
 *
 * For images uploaded through our pipeline: resolves to the correct
 * stored size variant (no runtime resizing needed).
 *
 * For external URLs: uses CDN-specific params or edge function proxy.
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

  // ── 1. Our own pipeline variants ──
  if (isOptimizedUrl(url)) {
    // Pick the best matching stored variant
    const best = pickBestVariant(width);
    return resolveVariantUrl(url, best);
  }

  // ── 1b. Cloudflare Image CDN (format=auto → AVIF/WebP) ──
  if (isCfImageEligible(url)) {
    return cfImageUrl(url, width, quality);
  }

  // ── 2. Shopify CDN ──
  if (url.includes("cdn.shopify.com")) {
    const u = new URL(url);
    u.searchParams.set("width", String(width));
    u.searchParams.set("format", "webp");
    return u.toString();
  }

  // ── 2b. Shopify custom domain CDN (e.g. customstore.com/cdn/shop/) ──
  // Only set width — custom domains may not support format=webp
  if (url.includes("/cdn/shop/")) {
    const u = new URL(url);
    u.searchParams.set("width", String(width));
    return u.toString();
  }

  // ── 3. Unsplash ──
  if (url.includes("images.unsplash.com")) {
    const u = new URL(url);
    u.searchParams.set("w", String(width));
    u.searchParams.set("q", String(quality));
    u.searchParams.set("fm", "webp");
    u.searchParams.set("auto", "format");
    return u.toString();
  }

  // ── 4. Supabase Storage: use render/image transform API ──
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

  // ── 5. External URL — edge function proxy ──
  if (url.startsWith("https://") || url.startsWith("http://")) {
    try {
      if (SUPABASE_PROJECT_ID) {
        return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/image-resize?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
      }
    } catch {
      // Invalid URL, return as-is
    }
  }

  return url;
}

/** Pick the closest stored variant width that is ≥ requested width */
function pickBestVariant(requestedWidth: number): VariantWidth {
  for (const w of PIPELINE_WIDTHS) {
    if (w >= requestedWidth) return w;
  }
  return 800;
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
 *
 * For pipeline-optimized images: uses actual stored variant files (200w, 400w, 800w).
 * For external images: generates srcSet via CDN params / proxy.
 */
export function getImageSrcSet(
  url: string | null | undefined,
  sizes: number[] = [200, 400, 800],
  quality: number = 75,
): string {
  if (!url) return "";

  const firstUrl = url.includes(",") ? url.split(",")[0].trim() : url.trim();
  if (!firstUrl) return "";

  // For our pipeline images, only emit the 3 stored widths
  if (isOptimizedUrl(firstUrl)) {
    return PIPELINE_WIDTHS
      .map((w) => `${resolveVariantUrl(firstUrl, w)} ${w}w`)
      .join(", ");
  }

  // For external images, use runtime optimization
  return sizes
    .map((w) => `${optimizeImageUrl(firstUrl, w, quality)} ${w}w`)
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
  const srcSet = getImageSrcSet(url, [200, 400, 800], 75);
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
