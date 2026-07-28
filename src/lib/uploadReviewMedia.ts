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

const MAX_IMAGE_DIM = 1200;

async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    if (!blob) return file;
    return new File([blob], `review.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function uploadReviewMedia(file: File, storeId: string): Promise<ReviewMedia> {
  const isVideo = (file.type || "").startsWith("video/");
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
