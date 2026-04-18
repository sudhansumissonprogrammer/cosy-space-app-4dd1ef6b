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
const ENABLE_EDGE_IMAGE_PROXY = import.meta.env.VITE_ENABLE_EDGE_IMAGE_PROXY === "true";

/**
 * v6.3.0: Route through Cloudflare Worker `/cf-img` endpoint, which uses
 * Cloudflare Image Resizing (cf.image) at the edge — auto WebP/AVIF, exact
 * size, 1-year edge cache. Disabled on localhost / preview where Worker
 * isn't in front (falls back to direct Supabase render API).
 */
function shouldUseCfImg(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "localhost" || h.startsWith("127.") || h.endsWith(".lovable.app")) return false;
  return true;
}

/**
 * Hosts whitelisted in the Cloudflare Worker's /cf-img endpoint.
 * Must mirror docs/cloudflare-worker-current.js. URLs from any other
 * origin would get 403 "Origin not allowed", so we serve them directly.
 */
function isCfImgAllowedOrigin(originUrl: string): boolean {
  try {
    const h = new URL(originUrl).hostname;
    return (
      h.endsWith(".supabase.co") ||
      h.endsWith(".r2.dev") ||
      h.endsWith(".cloudinary.com") ||
      h.endsWith(".unsplash.com") ||
      h.endsWith(".shopify.com") ||
      h.endsWith(".myshopify.com") ||
      h === "cdn.shopify.com"
    );
  } catch {
    return false;
  }
}

function cfImgUrl(originUrl: string, width: number, quality: number): string {
  return `/cf-img?url=${encodeURIComponent(originUrl)}&w=${width}&q=${quality}`;
}

/** We now store only 800w — render API handles responsive sizes */
const PIPELINE_WIDTHS: number[] = [400, 800];

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
  quality: number = 85,
): string {
  if (!url) return "";

  // Handle comma-separated URLs — take only the first one
  const firstUrl = url.includes(",") ? url.split(",")[0].trim() : url.trim();
  if (!firstUrl) return "";
  url = firstUrl;

  // ── 1. Our pipeline images: prefer Cloudflare resize at edge ──
  if (isOptimizedUrl(url)) {
    const baseUrl = resolveVariantUrl(url, 800);
    if (width >= 800 && !shouldUseCfImg()) return baseUrl;
    if (shouldUseCfImg()) {
      return cfImgUrl(baseUrl, width, quality);
    }
    // Fallback: Supabase render API
    try {
      const u = new URL(baseUrl);
      u.pathname = u.pathname.replace(
        "/storage/v1/object/",
        "/storage/v1/render/image/",
      );
      u.searchParams.set("width", String(width));
      u.searchParams.set("quality", String(quality));
      u.searchParams.set("resize", "contain");
      return u.toString();
    } catch {
      return baseUrl;
    }
  }

  // ── 2. Shopify CDN: route through CF resize for max savings ──
  if (url.includes("cdn/shop/") || url.includes("cdn.shopify.com")) {
    if (shouldUseCfImg()) return cfImgUrl(url, width, quality);
    const u = new URL(url);
    u.searchParams.set("width", String(width));
    u.searchParams.set("format", "webp");
    return u.toString();
  }

  // ── 3. Unsplash ──
  if (url.includes("images.unsplash.com")) {
    if (shouldUseCfImg()) return cfImgUrl(url, width, quality);
    const u = new URL(url);
    u.searchParams.set("w", String(width));
    u.searchParams.set("q", String(quality));
    u.searchParams.set("fm", "webp");
    u.searchParams.set("auto", "format");
    return u.toString();
  }

  // ── 4. Supabase Storage (external/legacy uploads): route through CF ──
  if (url.includes("supabase.co/storage")) {
    if (shouldUseCfImg()) return cfImgUrl(url, width, quality);
    // Fallback: Supabase render API
    try {
      const u = new URL(url);
      u.pathname = u.pathname.replace(
        "/storage/v1/object/",
        "/storage/v1/render/image/",
      );
      u.searchParams.set("width", String(width));
      u.searchParams.set("quality", String(quality));
      u.searchParams.set("resize", "contain");
      return u.toString();
    } catch {
      return url;
    }
  }

  // ── 5. External URL ──
  if (url.startsWith("https://") || url.startsWith("http://")) {
    if (shouldUseCfImg() && isCfImgAllowedOrigin(url)) return cfImgUrl(url, width, quality);
    if (ENABLE_EDGE_IMAGE_PROXY && SUPABASE_PROJECT_ID) {
      return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/image-ops?action=resize&url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
    }
    return url;
  }

  return url;
}

/** @deprecated No longer needed — render API handles all sizes */
function pickBestVariant(requestedWidth: number): 800 {
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
 * Resolve all available images for a product, combining image_url and product_images.
 * Falls back to product_images if image_url is empty.
 */
export function resolveProductImages(product: any): string[] {
  const fromUrl = splitImageUrls(product?.image_url);
  if (fromUrl.length > 0) return fromUrl;
  // Fallback to product_images array from RPC data
  const piArr = product?.product_images;
  if (Array.isArray(piArr) && piArr.length > 0) {
    return piArr
      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((pi: any) => pi.image_url)
      .filter((u: string) => !!u);
  }
  return [];
}

/**
 * Get a srcSet string for responsive images.
 *
 * For pipeline-optimized images: uses actual stored variant files (200w, 400w, 800w).
 * For external images: generates srcSet via CDN params / proxy.
 */
export function getImageSrcSet(
  url: string | null | undefined,
  sizes: number[] = [400, 800],
  quality: number = 85,
): string {
  if (!url) return "";

  const firstUrl = url.includes(",") ? url.split(",")[0].trim() : url.trim();
  if (!firstUrl) return "";

  // For ALL images (pipeline or external), use optimizeImageUrl which handles
  // render API for pipeline images and CDN params for external
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
  const srcSet = getImageSrcSet(url, [400, 800], 75);
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
