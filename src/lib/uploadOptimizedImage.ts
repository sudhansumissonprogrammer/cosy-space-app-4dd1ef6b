/**
 * Centralized upload handler — now uploads to Cloudflare R2 via edge function.
 *
 * Pipeline:
 *   1. Compress to 800w WebP client-side
 *   2. POST to `r2-upload` edge function (S3 PUT to R2)
 *   3. Returns the public cdn.shopbanao.in URL
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
 * Upload an image to Cloudflare R2 with automatic optimization (single 800w file).
 *
 * @param file        Raw image file from the user
 * @param bucket      Logical bucket prefix (e.g. "product-images")
 * @param basePath    Path prefix (e.g. "userId/storeId/1234abc")
 * @returns UploadResult with URL
 */
export async function uploadOptimizedImage(
  file: File,
  bucket: string,
  basePath: string,
): Promise<UploadResult> {
  const result: MultiSizeResult = await processImageMultiSize(file);
  const variantFile = result.variants.get(800);
  if (!variantFile) throw new Error("Image compression failed — no output file");

  const ext = variantFile.name.split(".").pop() || "webp";
  const path = `${basePath}-800w.${ext}`;

  const form = new FormData();
  form.append("file", variantFile);
  form.append("bucket", bucket);
  form.append("path", path);

  const { data, error } = await supabase.functions.invoke("r2-upload", {
    body: form,
  });

  if (error) throw new Error(`Failed to upload image: ${error.message}`);
  if (!data?.publicUrl) throw new Error("Upload failed: no URL returned");

  const mainUrl = data.publicUrl as string;
  const variantUrls = new Map<VariantWidth, string>();
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
 * Note: We only store 800w now. This function returns the same URL since
 * R2 serves a single file size — the browser downscales as needed.
 */
export function resolveVariantUrl(
  mainUrl: string,
  _width: VariantWidth,
): string {
  return mainUrl;
}

/**
 * Check if a URL was produced by our optimization pipeline.
 */
export function isOptimizedUrl(url: string): boolean {
  return /^.+-\d+w\.(webp|jpg|jpeg)$/i.test(url);
}
