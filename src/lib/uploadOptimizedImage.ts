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
  const result: MultiSizeResult = await processImageMultiSize(file, undefined, bucket === "product-images");
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

  if (error) {
    let message = error.message || "Upload failed";
    const response = (error as any)?.context;
    if (response && typeof response.clone === "function") {
      try {
        const payload = await response.clone().json();
        if (payload?.error) message = payload.error;
      } catch {
        try {
          const text = await response.clone().text();
          if (text) message = text;
        } catch {
          // Keep the original SDK message.
        }
      }
    }
    throw new Error(`Failed to upload image: ${message}`);
  }
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

/**
 * Store logos are rendered at most ~168px (splash screen) / ~40px (header),
 * so a full 800w upload is wasted bytes that delay the branded splash.
 * This always downscales to 384px max side and encodes WebP q0.86 —
 * typically 2–30KB instead of 100KB+.
 */
export async function uploadStoreLogo(
  file: File,
  basePath: string,
): Promise<string> {
  const LOGO_MAX = 384;

  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error("Could not read the logo file"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not decode the logo file"));
    i.src = dataUrl;
  });

  const scale = Math.min(1, LOGO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/webp", 0.86),
  );
  // Old Safari / privacy browsers can return null for WebP — r2-upload
  // re-encodes server-side, so falling back to PNG is safe.
  const finalBlob =
    blob ??
    (await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png")));
  if (!finalBlob) throw new Error("Logo compression failed");

  const ext = finalBlob.type === "image/webp" ? "webp" : "png";
  const logoFile = new File([finalBlob], `logo-384w.${ext}`, { type: finalBlob.type });
  const path = `${basePath}-384w.${ext}`;

  const form = new FormData();
  form.append("file", logoFile);
  form.append("bucket", "store-logos");
  form.append("path", path);

  const { data, error } = await supabase.functions.invoke("r2-upload", { body: form });
  if (error) throw new Error(`Failed to upload logo: ${error.message || "upload failed"}`);
  if (!data?.publicUrl) throw new Error("Logo upload failed: no URL returned");
  return data.publicUrl as string;
}
