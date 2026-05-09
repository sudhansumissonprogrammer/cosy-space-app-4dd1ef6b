/**
 * Centralized upload handler for the image optimization pipeline.
 *
 * On every upload:
 *  1. Compresses to a single 800w WebP variant client-side
 *  2. Uploads ONE file to Supabase Storage
 *  3. Returns the public URL as the main reference
 *
 * Responsive serving is handled by Supabase render API at request time:
 *   /storage/v1/render/image/...?width=400&quality=85
 *
 * Naming: {basePath}-800w.webp
 */

import { supabase } from "@/integrations/supabase/client";
import {
  processImageMultiSize,
  type MultiSizeResult,
  type VariantWidth,
  getCompressionMessage,
} from "./imageCompression";

export interface UploadResult {
  /** The main (800w) public URL — use this as image_url */
  mainUrl: string;
  /** Map of width → public URL (now contains only 800w) */
  variantUrls: Map<VariantWidth, string>;
  /** Human-readable compression message */
  compressionMessage: string | null;
}

/**
 * Upload an image with automatic optimization (single 800w file).
 *
 * @param file        Raw image file from the user
 * @param bucket      Storage bucket name (e.g. "product-images")
 * @param basePath    Path prefix (e.g. "userId/storeId/1234abc")
 * @returns UploadResult with URL
 */
export async function uploadOptimizedImage(
  file: File,
  bucket: string,
  basePath: string,
): Promise<UploadResult> {
  const result: MultiSizeResult = await processImageMultiSize(file);
  const variantUrls = new Map<VariantWidth, string>();

  // Upload the single 800w variant
  const variantFile = result.variants.get(800);
  if (!variantFile) throw new Error("Image compression failed — no output file");

  const ext = variantFile.name.split(".").pop() || "webp";
  const path = `${basePath}-800w.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, variantFile, {
      cacheControl: "31536000", // 1 year — immutable content-addressed
      upsert: true,
      contentType: variantFile.type,
    });

  if (error) throw new Error(`Failed to upload image: ${error.message}`);

  const mainUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
  variantUrls.set(800, mainUrl);

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
  return /^.+-\d+w\.(webp|jpg|jpeg|avif)$/i.test(url);
}

/**
 * Derive the sibling AVIF URL for a pipeline-optimized image.
 * Returns null if the URL doesn't look like one we produced.
 *
 * NOTE: This URL is "best-effort" — older uploads predating AVIF support
 * will not have an AVIF sibling. Callers using <picture><source type="image/avif">
 * should be aware that AVIF may 404 for legacy images. Only enable AVIF
 * sources behind a flag once back-fill is complete.
 */
export function resolveAvifUrl(mainUrl: string): string | null {
  const match = mainUrl.match(/^(.+)-(\d+)w\.(webp|jpg|jpeg)$/i);
  if (!match) return null;
  return `${match[1]}-${match[2]}w.avif`;
}
