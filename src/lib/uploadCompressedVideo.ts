/**
 * uploadCompressedVideo — lossless direct R2 upload with a generated poster.
 *
 * Previous implementation used ffmpeg.wasm (single-threaded, ~30MB core
 * fetched from unpkg) which frequently hung on Loading compressor… or
 * crashed in older mobile WebViews — videos never reached R2. Modern
 * phone cameras already record H.264 MP4, so we now:
 *
 *   1. Validate file (≤60s by default, ≤100MB, video/*)
 *   2. Grab a poster frame via <video> + <canvas> (instant, no WASM)
 *   3. Upload the ORIGINAL video and poster to R2 via r2-upload
 *
 * Browser playback-capture re-encoding is deliberately not used. It produced
 * low-frame-rate files on some Android/WebView devices even when the source
 * was smooth. Preserving the original also keeps audio, HDR/rotation metadata,
 * frame cadence and quality exactly as recorded.
 */
import { supabase } from "@/integrations/supabase/client";

export interface VideoUploadResult {
  videoUrl: string;
  posterUrl: string;
  originalBytes: number;
  compressedBytes: number;
}

export interface VideoUploadOptions {
  userId: string;
  storeId: string;
  /** Called with 0..1 during upload */
  onProgress?: (pct: number) => void;
  /** Called with a stage label for UI */
  onStage?: (stage: "loading-ffmpeg" | "compressing" | "uploading-video" | "uploading-poster") => void;
  /** Max duration in seconds (default 60) */
  maxDurationSec?: number;
  /** Max raw upload bytes (default 100MB) */
  maxRawBytes?: number;
}

interface VideoMeta {
  duration: number;
  width: number;
  height: number;
}

function probeVideo(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => {
      const meta = {
        duration: v.duration || 0,
        width: v.videoWidth || 0,
        height: v.videoHeight || 0,
      };
      cleanup();
      resolve(meta);
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("Could not read video file"));
    };
  });
}

async function generatePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
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
        // Seek a bit in so we don't get a black first frame.
        const target = Math.min(0.1, (v.duration || 1) / 10);
        v.currentTime = target;
      } catch {
        finish(null);
      }
    };
    v.onseeked = () => {
      try {
        const maxW = 720;
        const ratio = v.videoWidth && v.videoHeight ? v.videoHeight / v.videoWidth : 0.5625;
        const w = Math.min(maxW, v.videoWidth || maxW);
        const h = Math.round(w * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(v, 0, 0, w, h);
        canvas.toBlob(
          (blob) => finish(blob),
          "image/jpeg",
          0.82,
        );
      } catch {
        finish(null);
      }
    };
    v.onerror = () => finish(null);

    // Hard timeout — if poster can't be made, upload video without it.
    setTimeout(() => finish(null), 8000);
  });
}

function genPath(userId: string, storeId: string, ext: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userId}/${storeId}/${ts}-${rand}.${ext}`;
}

async function uploadToR2(file: File | Blob, name: string, bucket: string, path: string): Promise<string> {
  const form = new FormData();
  const f = file instanceof File ? file : new File([file], name, { type: file.type || "application/octet-stream" });
  form.append("file", f);
  form.append("bucket", bucket);
  form.append("path", path);
  const { data, error } = await supabase.functions.invoke("r2-upload", { body: form });
  if (error) {
    // Surface the real server message ("File too large", "Unauthorized", ...)
    // instead of the opaque "Edge Function returned a non-2xx status code".
    let detail = error.message;
    try {
      const res = (error as any)?.context;
      if (res && typeof res.json === "function") {
        const body = await res.clone().json();
        if (body?.error) detail = body.error;
      }
    } catch { /* keep default */ }
    throw new Error(`Upload failed: ${detail}`);
  }
  if (!data?.publicUrl) throw new Error("Upload failed: no URL returned");
  return data.publicUrl as string;
}


function inferExt(file: File): string {
  const m = file.name.match(/\.([a-z0-9]+)$/i);
  if (m) return m[1].toLowerCase();
  const t = (file.type || "").toLowerCase();
  if (t.includes("quicktime")) return "mov";
  if (t.includes("webm")) return "webm";
  return "mp4";
}

export async function uploadCompressedVideo(
  file: File,
  opts: VideoUploadOptions,
): Promise<VideoUploadResult> {
  const maxDur = opts.maxDurationSec ?? 60;
  const maxBytes = opts.maxRawBytes ?? 100 * 1024 * 1024;

  if (!file.type.startsWith("video/")) throw new Error("Please choose a video file");
  if (file.size > maxBytes) {
    throw new Error(`Video must be under ${Math.round(maxBytes / 1024 / 1024)}MB (yours is ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  let meta: VideoMeta;
  try {
    meta = await probeVideo(file);
  } catch (e: any) {
    throw new Error(e?.message || "Could not read video file");
  }
  if (meta.duration && meta.duration > maxDur + 1) {
    throw new Error(`Video must be under ${maxDur} seconds (yours is ${Math.round(meta.duration)}s)`);
  }

  // Poster (best effort — never blocks the upload)
  opts.onStage?.("compressing");
  opts.onProgress?.(0.05);
  const posterBlob = await generatePoster(file);
  opts.onProgress?.(0.1);

  // Always preserve the source file. A browser cannot safely infer that a
  // playback-captured re-encode retained every frame, so even large accepted
  // files are uploaded untouched rather than risking permanent judder.
  const uploadBlob: File = file;
  const uploadName = file.name;
  const uploadExt = inferExt(file);
  const compressedBytes = file.size;


  // Upload video
  opts.onStage?.("uploading-video");
  opts.onProgress?.(0.75);
  const videoPath = genPath(opts.userId, opts.storeId, uploadExt);
  const videoUrl = await uploadToR2(uploadBlob, uploadName, "product-videos", videoPath);
  opts.onProgress?.(0.9);

  // Upload poster (or fall back to video URL)
  let posterUrl = "";
  if (posterBlob) {
    opts.onStage?.("uploading-poster");
    try {
      const posterPath = genPath(opts.userId, opts.storeId, "jpg");
      posterUrl = await uploadToR2(posterBlob, "poster.jpg", "product-videos", posterPath);
    } catch {
      posterUrl = "";
    }
  }
  opts.onProgress?.(1);

  return {
    videoUrl,
    posterUrl,
    originalBytes: file.size,
    compressedBytes,
  };
}
