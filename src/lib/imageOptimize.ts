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

import { getProductCardVariantWidth, isOptimizedUrl, resolveVariantUrl } from "./uploadOptimizedImage";
import { getAdaptiveQuality, shouldPreloadLcp } from "./networkHints";
import { verifiedThumbnail } from "./verifiedThumbnails";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
const ENABLE_EDGE_IMAGE_PROXY = import.meta.env.VITE_ENABLE_EDGE_IMAGE_PROXY === "true";

/**
 * v8.5 — `/cf-img` Worker proxy disabled. Every image hit was generating a
 * paid Cloudflare Worker invocation; we now go direct to Supabase Storage's
 * Render API (`/storage/v1/render/image/`), which is free and CDN-cached
 * by Supabase. Net cost saving: ~5-30 Worker events per pageview.
 */

/**
 * v8.93 — `/cf-img` restored for supplier catalog CDNs.
 *
 * v8.88 sent supplier originals straight to the browser. Those origins serve
 * multi-thousand-pixel files (measured: 660KB / 540KB / 480KB each on
 * utkalwatch.in/category/sale → 21MB of images per page) with NO resize
 * params, which destroys LCP on mobile. The Worker resize route returns a
 * ~28KB WebP for the same file at w=400 and is edge-cached
 * (`immutable`, 1 year, cf-cache HIT), so the extra hop is paid once per
 * variant per PoP.
 *
 * MUST stay in sync with CF_IMG_HOSTS in docs/cloudflare-worker-current.js.
 */
const EDGE_RESIZE_HOSTS = new Set([
  "assets.jdwebnship.in",
  "assets.jdwebnship.com",
  "cdn.cartpe.in",
  "assets.mycatalog.io",
  "watchtrade.in",
  "www.watchtrade.in",
  "overlaysnow.com",
  "www.overlaysnow.com",
]);

/** True when the host is a supplier CDN we resize at the edge. */
export function isEdgeResizeHost(url: string): boolean {
  try {
    return EDGE_RESIZE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** True only where the Cloudflare Worker (and thus `/cf-img`) is in front. */
function isWorkerHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
  if (h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com")) return false;
  return true;
}






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

  // Handle comma-separated URL lists — split only where a new URL begins,
  // so CDNs with commas inside the path (e.g. ImageKit "tr:w-800,f-webp") survive.
  const firstUrl = url.split(/,\s*(?=https?:\/\/)/)[0].trim();
  if (!firstUrl) return "";
  url = firstUrl;

  const smallCopy = verifiedThumbnail(url, isOptimizedUrl(url) ? resolveVariantUrl(url, width) : url, width);
  if (smallCopy) return smallCopy;

  // ── 1. Our pipeline images on R2/CDN: use stored variants ──
  if (isOptimizedUrl(url)) {
    const variant = resolveVariantUrl(url, width);
    // Legacy Supabase Storage pipeline images (pre-R2 migration) still use render API
    if (variant.includes("supabase.co/storage")) {
      try {
        const u = new URL(variant);
        u.pathname = u.pathname.replace(
          "/storage/v1/object/",
          "/storage/v1/render/image/",
        );
        u.searchParams.set("width", String(width));
        u.searchParams.set("quality", String(quality));
        u.searchParams.set("resize", "contain");
        return u.toString();
      } catch {
        return variant;
      }
    }
    // R2/CDN URLs — direct variant, with no runtime resize cost.
    return variant;
  }

  // ── 2. Shopify CDN (incl. custom Shopify domains using /cdn/shop/): native resize ──
  if (url.includes("/cdn/shop/") || url.includes("cdn.shopify.com")) {
    // Shopify supports ?width= natively — use it directly to avoid CF allowlist issues
    try {
      const u = new URL(url);
      u.searchParams.set("width", String(width));
      return u.toString();
    } catch {
      return url;
    }
  }

  // ── 3. Unsplash: native CDN params (no Worker hit) ──
  // Tier-1 #11: `auto=format` lets Unsplash serve AVIF to capable browsers,
  // WebP otherwise. Dropping `fm=webp` (was forcing WebP and blocking AVIF).
  if (url.includes("images.unsplash.com")) {
    try {
      const u = new URL(url);
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", String(quality));
      u.searchParams.set("auto", "format");
      return u.toString();
    } catch {
      return url;
    }
  }

  // ── 4. Supabase Storage: use Supabase render API directly ──
  if (url.includes("supabase.co/storage")) {
    try {
      const u = new URL(url);
      u.pathname = u.pathname.replace(
        "/storage/v1/object/",
        "/storage/v1/render/image/",
      );
      u.searchParams.set("width", String(width));
      u.searchParams.set("quality", String(quality));
      u.searchParams.set("resize", "contain");
      // Render auto-WebP via Accept header — omit `format` param.
      return u.toString();
    } catch {
      return url;
    }
  }

  // ── 5. Supplier catalog CDNs: resize at the edge (`/cf-img`) ──
  // Only on Worker-served hosts (production). Localhost / lovable previews
  // have no Worker, so they keep the raw origin URL.
  if (url.startsWith("https://") || url.startsWith("http://")) {
    if (ENABLE_EDGE_IMAGE_PROXY && SUPABASE_PROJECT_ID) {
      return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/image-ops?action=resize&url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
    }
    if (isEdgeResizeHost(url) && isWorkerHost()) {
      return `${window.location.origin}/cf-img?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
    }
    return url;
  }




  return url;
}

/** Extract the first URL from a potentially comma-separated image_url field */
export function cleanImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.split(/,\s*(?=https?:\/\/)/)[0].trim();
}

/** Split a comma-separated image_url field into an array of individual URLs */
export function splitImageUrls(url: string | null | undefined): string[] {
  if (!url) return [];
  return url
    .split(/,\s*(?=https?:\/\/)/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

/**
 * Resolve all available images for a product, combining image_url and product_images.
 * Falls back to product_images if image_url is empty.
 */
export function resolveProductImages(product: any): string[] {
  const fromUrl = splitImageUrls(product?.image_url);
  const piArr = product?.product_images;
  const extras = Array.isArray(piArr)
    ? [...piArr]
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((pi: any) => typeof pi.image_url === "string" ? pi.image_url.trim() : "")
        .filter((u: string) => !!u)
    : [];

  // The primary image stays first, but gallery rows must still be included.
  // Older behaviour returned early whenever image_url existed, which made
  // every extra PDP image disappear in themes that use this shared resolver.
  return Array.from(new Set([...fromUrl, ...extras]));
}

/**
 * Get a srcSet string for responsive images.
 *
 * For pipeline-optimized images: uses only variants known to exist.
 * For external images: generates srcSet via CDN params / proxy.
 */
export function getImageSrcSet(
  url: string | null | undefined,
  sizes: number[] = [300, 500, 700, 900],
  quality: number = 72,
): string {
  if (!url) return "";

  const firstUrl = url.split(/,\s*(?=https?:\/\/)/)[0].trim();
  if (!firstUrl) return "";

  // Product uploads store 400w OR 800w cards, plus 1200w/2000w siblings.
  // Legacy single-file 800w uploads stay on their known-good URL.
  if (isOptimizedUrl(firstUrl)) {
    // A tiny src must not be overridden by an 800w srcSet candidate.
    if (sizes.length > 0 && Math.max(...sizes) <= 320) {
      const small = optimizeImageUrl(firstUrl, Math.max(...sizes), quality);
      if (small.includes("/__l5e/assets-v1/")) return "";
      if (/-thumb160-1200w\.(webp|jpg|jpeg)$/i.test(firstUrl) && Math.max(...sizes) <= 160) {
        return `${resolveVariantUrl(firstUrl, 160)} 160w`;
      }
    }
    const isResponsiveR2 = /-1200w\.(webp|jpg|jpeg)$/i.test(firstUrl);
    if (isResponsiveR2 && !firstUrl.includes("supabase.co/storage")) {
      const cardWidth = getProductCardVariantWidth(firstUrl);
      const candidates = Math.max(...sizes) >= 1000 && cardWidth !== 1200 ? [cardWidth, 1200] : [cardWidth];
      return candidates.map((width) => `${resolveVariantUrl(firstUrl, width)} ${width}w`).join(", ");
    }
    const variant = resolveVariantUrl(firstUrl, 800);
    if (!variant.includes("supabase.co/storage")) {
      return "";
    }
  }

  // For external CDNs and legacy Supabase render: real responsive sizes.
  // v8.88: if the transform is a no-op (plain supplier URL served direct),
  // every entry would be the same URL — skip srcset entirely.
  const entries = sizes.map((w) => ({ w, u: optimizeImageUrl(firstUrl, w, quality) }));
  if (entries.length === 0) return "";
  if (entries.every((e) => e.u === entries[0].u)) return "";
  return entries.map((e) => `${e.u} ${e.w}w`).join(", ");
}


/**
 * Standard `sizes` attribute for product cards in a responsive grid.
 * Mobile cards are ~half-viewport (~180-200px CSS = 360-400px DPR-2) so we
 * advertise the actual rendered width — the browser then picks the closest
 * srcSet entry (800w card variant) instead of the 1200w PDP variant.
 */
export const PRODUCT_CARD_SIZES =
  "(max-width: 640px) 45vw, (max-width: 1024px) 28vw, (max-width: 1440px) 20vw, 16vw";

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
  // Bug #4 fix: skip preload on save-data / 2G — keeps bandwidth for critical
  // JSON/JS and avoids wasted bytes when the user opted out of heavy media.
  if (!shouldPreloadLcp()) return undefined;

  const q = getAdaptiveQuality(75);
  const optimized = optimizeImageUrl(url, width, q);
  if (!optimized) return undefined;

  const existing = document.querySelector(
    `link[rel="preload"][href="${optimized}"]`,
  );
  if (existing) return undefined;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = optimized;
  link.setAttribute("fetchpriority", "high");
  const srcSet = getImageSrcSet(url, [400, 800], q);
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

/** Must mirror the Worker PDP hero preload srcset/sizes byte-for-byte. */
export const PDP_HERO_SIZES = "(max-width: 640px) 100vw, 50vw";

/**
 * Main PDP photo: offer the existing 800w sibling next to the canonical 1200w
 * so DPR≤2 phones download ~60% less. Only for upload families whose 800w
 * sibling is known to exist; everything else keeps the single 1200w URL.
 */
export function getPdpHeroSrcSet(url: string | null | undefined): string {
  if (!url || url.includes("supabase.co/storage")) return "";
  if (!/^https:\/\/cdn\.shopbanao\.in\//.test(url)) return "";
  if (/-thumb160-1200w\./i.test(url)) return "";
  if (!/\/\d{13}-[^/]+-1200w\.(webp|jpg|jpeg)$/i.test(url)) return "";
  if (getProductCardVariantWidth(url) !== 800) return "";
  return `${resolveVariantUrl(url, 800)} 800w, ${url} 1200w`;
}
