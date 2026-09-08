/**
 * Customer review media upload (anonymous shoppers).
 *
 * Images are compressed client-side to 1200px WebP before hitting the
 * `review-upload` edge function; videos are passed through as-is (size capped
 * server-side at 40MB).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ReviewMedia {
  url: string;
  type: "image" | "video";
}

/** Review photos keep near-original detail — only very large phone shots shrink. */
const MAX_IMAGE_DIM = 2200;
const WEBP_QUALITY = 0.92;
/** Small originals are uploaded untouched (no re-encode = no quality loss). */
const PASSTHROUGH_BYTES = 2 * 1024 * 1024;
/** Hard cap enforced server-side for images */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function decodeToBitmapSource(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    return bitmap as any;
  } catch {
    // Fallback for formats createImageBitmap can't handle directly (some HEIC/iOS cases)
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode failed"));
        el.src = url;
      });
      return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight }) as any;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }
}

/** Always converts to WebP; throws a friendly error if the image can't be read. */
async function compressImage(file: File): Promise<File> {
  const src = await decodeToBitmapSource(file).catch(() => null);
  if (!src || !src.width || !src.height) {
    throw new Error("This image format isn't supported. Please try a JPG or PNG photo.");
  }
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process this photo. Please try another one.");
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = "high";
  ctx.drawImage(src as any, 0, 0, w, h);
  (src as any).close?.();

  let quality = WEBP_QUALITY;
  let blob: Blob | null = null;
  for (let i = 0; i < 5; i++) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    // Safari <14 returns PNG when webp is unsupported — accept it if small enough
    if (!blob) break;
    if (blob.size <= MAX_IMAGE_BYTES) break;
    quality -= 0.08;
  }
  if (!blob) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  }
  if (!blob) throw new Error("Could not process this photo. Please try another one.");
  if (blob.size > MAX_IMAGE_BYTES) throw new Error("Photo is too large. Please pick a smaller one.");

  const isWebp = blob.type === "image/webp";
  return new File([blob], isWebp ? "review.webp" : "review.jpg", {
    type: isWebp ? "image/webp" : "image/jpeg",
  });
}


export async function uploadReviewMedia(file: File, storeId: string): Promise<ReviewMedia> {
  const isVideo = (file.type || "").startsWith("video/");
  if (isVideo && file.size > 40 * 1024 * 1024) {
    throw new Error("Video is too large (max 40MB). Please pick a shorter clip.");
  }
  const payload = isVideo ? file : await compressImage(file);


  const form = new FormData();
  form.append("file", payload);
  form.append("store_id", storeId);

  const { data, error } = await supabase.functions.invoke("review-upload", { body: form });
  if (error) {
    let message = error.message || "Upload failed";
    const res = (error as any)?.context;
    if (res && typeof res.clone === "function") {
      try {
        const body = await res.clone().json();
        if (body?.error) message = body.error;
      } catch {
        /* keep default */
      }
    }
    throw new Error(message);
  }
  if (!data?.publicUrl) throw new Error("Upload failed");
  return { url: data.publicUrl as string, type: (data.type as "image" | "video") || "image" };
}
