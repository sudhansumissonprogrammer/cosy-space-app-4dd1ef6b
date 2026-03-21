/**
 * Centralized upload handler for the image optimization pipeline.
 *
 * On every upload:
 *  1. Generates 200px, 400px, 800px WebP variants client-side
 *  2. Uploads all variants to Supabase Storage
 *  3. Returns the 800px URL as the main reference
 *
 * The naming convention allows imageOptimize.ts to resolve srcSet
 * from actual stored files instead of runtime proxies.
 *
 * Naming: {basePath}-200w.webp, {basePath}-400w.webp, {basePath}-800w.webp
 */

import { supabase } from "@/integrations/supabase/client";
import {
  processImageMultiSize,
  IMAGE_VARIANT_WIDTHS,
  type MultiSizeResult,
  type VariantWidth,
  getCompressionMessage,
} from "./imageCompression";

export interface UploadResult {
  /** The main (800w) public URL — use this as image_url */
  mainUrl: string;
  /** Map of width → public URL for all variants */
  variantUrls: Map<VariantWidth, string>;
  /** Human-readable compression message */
  compressionMessage: string | null;
}

/**
 * Upload an image with automatic multi-size optimization.
 *
 * @param file        Raw image file from the user
 * @param bucket      Storage bucket name (e.g. "product-images")
 * @param basePath    Path prefix (e.g. "userId/storeId/1234abc")
 * @returns UploadResult with URLs for all variants
 */
export async function uploadOptimizedImage(
  file: File,
  bucket: string,
  basePath: string,
): Promise<UploadResult> {
  const result: MultiSizeResult = await processImageMultiSize(file);
  const variantUrls = new Map<VariantWidth, string>();
  let mainUrl = "";

  // Upload all variants in parallel
  const uploads = IMAGE_VARIANT_WIDTHS.map(async (width) => {
    const variantFile = result.variants.get(width);
    if (!variantFile) return;

    const ext = variantFile.name.split(".").pop() || "webp";
    const path = `${basePath}-${width}w.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, variantFile, {
        cacheControl: "31536000", // 1 year — immutable content-addressed
        upsert: true,
        contentType: variantFile.type,
      });

    if (error) throw new Error(`Failed to upload ${width}w variant: ${error.message}`);

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
    variantUrls.set(width, publicUrl);

    if (width === 800) {
      mainUrl = publicUrl;
    }
  });

  await Promise.all(uploads);

  // Fallback if 800w was skipped (image smaller than 800px)
  if (!mainUrl) {
    const largest = [...variantUrls.entries()].sort((a, b) => b[0] - a[0])[0];
    if (largest) mainUrl = largest[1];
  }

  return {
    mainUrl,
    variantUrls,
    compressionMessage: getCompressionMessage(result.main),
  };
}

/**
 * Generate a unique base path for an upload.
 */
export function generateUploadPath(userId: string, storeId: string): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userId}/${storeId}/${timestamp}-${rand}`;
}

/**
 * Given a main image URL (800w), derive the variant URL for a given width.
 * Works for images uploaded through our pipeline.
 *
 * Example:
 *   resolveVariantUrl("https://.../-800w.webp", 400)
 *   → "https://.../-400w.webp"
 */
export function resolveVariantUrl(
  mainUrl: string,
  width: VariantWidth,
): string {
  // Match our naming convention: basePath-800w.ext
  const match = mainUrl.match(/^(.+)-(\d+)w\.(webp|jpg|jpeg|png)$/i);
  if (!match) return mainUrl;
  return `${match[1]}-${width}w.${match[3]}`;
}

/**
 * Check if a URL was produced by our optimization pipeline.
 */
export function isOptimizedUrl(url: string): boolean {
  return /^.+-\d+w\.(webp|jpg|jpeg)$/i.test(url);
}
