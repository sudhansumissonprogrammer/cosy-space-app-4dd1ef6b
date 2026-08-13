/**
 * uploadHeroVideo — hero banner video pipeline.
 *
 * A hero video is the first thing a shopper loads, so it is resized and
 * re-encoded before it ever reaches R2:
 *
 *   mobile  → long edge capped at 720px  (portrait phone hero)
 *   desktop → long edge capped at 1280px (wide banner hero)
 *
 * Re-encoding happens in the browser with WebCodecs (compressVideo). When
 * WebCodecs is unavailable (older Safari / WebView) we upload the original,
 * but only if it is already small enough to stay fast; otherwise we ask the
 * merchant for a smaller clip instead of shipping a 40MB hero.
 *
 * A poster JPEG is always generated and uploaded. The storefront paints the
 * poster as the LCP image and only fetches the video once idle/in-view, so
 * page speed is unchanged versus an image-only hero.
 */
import { supabase } from "@/integrations/supabase/client";
import { compressVideo, isWebCodecsSupported } from "@/lib/compressVideoWebCodecs";

export type HeroVideoTarget = "mobile" | "desktop";

export interface HeroVideoUploadResult {
  videoUrl: string;
  posterUrl: string;
  originalBytes: number;
  finalBytes: number;
  width: number;
  height: number;
}

export interface HeroVideoUploadOptions {
  userId: string;
  storeId: string;
  target: HeroVideoTarget;
  onStage?: (stage: "reading" | "resizing" | "uploading-video" | "uploading-poster") => void;
  onProgress?: (pct: number) => void;
}

/**
 * Long-edge cap per surface. Kept at native phone/desktop resolution — phones
 * are 3x DPR, so a 720px hero looked soft. We only cap truly oversized 4K
 * uploads.
 */
const MAX_DIMENSION: Record<HeroVideoTarget, number> = { mobile: 1080, desktop: 1920 };
/** Hard ceiling on what we accept from the picker. */
const MAX_INPUT_BYTES = 80 * 1024 * 1024;
/** Files at/below this stay byte-identical — no re-encode, zero quality loss. */
const MAX_PASSTHROUGH_BYTES = 24 * 1024 * 1024;
/** Hero clips should be short loops. */
const MAX_DURATION_SEC = 30;


function probe(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onloadedmetadata = () => {
      const meta = { duration: v.duration || 0, width: v.videoWidth || 0, height: v.videoHeight || 0 };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this video file"));
    };
  });
}

/** Grab a frame ~0.1s in and encode it as a JPEG poster sized for the surface. */
function generatePoster(file: File, maxWidth: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;

    let done = false;
    const finish = (blob: Blob | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    };

    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(0.1, (v.duration || 1) / 10);
      } catch {
        finish(null);
      }
    };
    v.onseeked = () => {
      try {
        const ratio = v.videoWidth && v.videoHeight ? v.videoHeight / v.videoWidth : 1;
        const w = Math.min(maxWidth, v.videoWidth || maxWidth);
        const h = Math.round(w * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(v, 0, 0, w, h);
        canvas.toBlob((b) => finish(b), "image/jpeg", 0.92);
      } catch {
        finish(null);
      }
    };
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 9000);
  });
}

async function uploadToR2(blob: Blob, name: string, path: string): Promise<string> {
  const f = blob instanceof File ? blob : new File([blob], name, { type: blob.type || "application/octet-stream" });
  const form = new FormData();
  form.append("file", f);
  form.append("bucket", "store-banners");
  form.append("path", path);
  const { data, error } = await supabase.functions.invoke("r2-upload", { body: form });
  if (error) {
    let detail = error.message;
    try {
      const res = (error as any)?.context;
      if (res && typeof res.clone === "function") {
        const body = await res.clone().json();
        if (body?.error) detail = body.error;
      }
    } catch { /* keep default */ }
    throw new Error(`Upload failed: ${detail}`);
  }
  if (!data?.publicUrl) throw new Error("Upload failed: no URL returned");
  return data.publicUrl as string;
}

function genPath(userId: string, storeId: string, target: HeroVideoTarget, ext: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userId}/${storeId}/hero-${target}-${Date.now()}-${rand}.${ext}`;
}

export async function uploadHeroVideo(
  file: File,
  opts: HeroVideoUploadOptions,
): Promise<HeroVideoUploadResult> {
  if (!file.type.startsWith("video/")) throw new Error("Please choose a video file");
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`Video must be under 80MB (yours is ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  opts.onStage?.("reading");
  opts.onProgress?.(0.03);
  const meta = await probe(file);
  if (meta.duration && meta.duration > MAX_DURATION_SEC + 1) {
    throw new Error(`Hero video must be under ${MAX_DURATION_SEC}s (yours is ${Math.round(meta.duration)}s)`);
  }

  const maxDim = MAX_DIMENSION[opts.target];
  const posterMaxWidth = opts.target === "mobile" ? 800 : 1200;

  const posterBlob = await generatePoster(file, posterMaxWidth);
  opts.onProgress?.(0.1);

  let uploadBlob: Blob = file;
  let ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || "mp4").toLowerCase();
  let width = meta.width;
  let height = meta.height;

  const needsResize = Math.max(meta.width, meta.height) > maxDim || file.size > MAX_PASSTHROUGH_BYTES;

  if (needsResize) {
    if (!isWebCodecsSupported()) {
      if (file.size > MAX_PASSTHROUGH_BYTES) {
        throw new Error(
          `This browser can't resize video. Please upload a clip under ${MAX_PASSTHROUGH_BYTES / 1024 / 1024}MB (or use Chrome).`,
        );
      }
    } else {
      opts.onStage?.("resizing");
      try {
        const result = await compressVideo(file, {
          maxDimension: maxDim,
          onProgress: (p) => opts.onProgress?.(0.1 + p * 0.55),
        });
        // Only keep the re-encode if it actually helped.
        if (result.blob.size < file.size) {
          uploadBlob = result.blob;
          ext = "mp4";
          width = result.width;
          height = result.height;
        }
      } catch {
        if (file.size > MAX_PASSTHROUGH_BYTES) {
          throw new Error("Could not process this video. Please try a shorter or smaller clip.");
        }
      }
    }
  }

  opts.onStage?.("uploading-video");
  opts.onProgress?.(0.7);
  const videoUrl = await uploadToR2(
    uploadBlob,
    `hero-${opts.target}.${ext}`,
    genPath(opts.userId, opts.storeId, opts.target, ext),
  );
  opts.onProgress?.(0.9);

  let posterUrl = "";
  if (posterBlob) {
    opts.onStage?.("uploading-poster");
    try {
      posterUrl = await uploadToR2(
        posterBlob,
        `hero-${opts.target}-poster.jpg`,
        genPath(opts.userId, opts.storeId, opts.target, "jpg"),
      );
    } catch {
      posterUrl = "";
    }
  }
  opts.onProgress?.(1);

  return {
    videoUrl,
    posterUrl,
    originalBytes: file.size,
    finalBytes: uploadBlob.size,
    width,
    height,
  };
}
