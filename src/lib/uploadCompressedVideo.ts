/**
 * uploadCompressedVideo — client-side video compression + R2 upload.
 *
 * Pipeline (lazy-loaded ffmpeg.wasm, single-threaded, no COOP/COEP needed):
 *   1. Validate (≤60s, ≤100MB, video/*)
 *   2. Transcode → H.264 720p, CRF 26, AAC 96k mono, +faststart
 *   3. Extract first-frame JPEG as poster
 *   4. Upload both to R2 via r2-upload edge function
 *
 * The @ffmpeg/* chunks are imported dynamically so they never touch any
 * other dashboard page or the storefront bundle — only loaded when a
 * merchant actually picks a video file.
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
  /** Called with 0..1 during compression */
  onProgress?: (pct: number) => void;
  /** Called with a stage label for UI */
  onStage?: (stage: "loading-ffmpeg" | "compressing" | "uploading-video" | "uploading-poster") => void;
  /** Max duration in seconds (default 60) */
  maxDurationSec?: number;
  /** Max raw upload bytes (default 100MB) */
  maxRawBytes?: number;
}

let _ffmpegPromise: Promise<any> | null = null;

async function loadFfmpeg(onStage?: VideoUploadOptions["onStage"]) {
  if (_ffmpegPromise) return _ffmpegPromise;
  onStage?.("loading-ffmpeg");
  _ffmpegPromise = (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);
    const ffmpeg = new FFmpeg();
    // Single-threaded core — works without SharedArrayBuffer / COOP-COEP.
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ffmpeg;
  })();
  return _ffmpegPromise;
}

async function getDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration || 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

function genPath(userId: string, storeId: string, ext: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userId}/${storeId}/${ts}-${rand}.${ext}`;
}

async function uploadToR2(file: File | Blob, name: string, bucket: string, path: string): Promise<string> {
  const form = new FormData();
  const f = file instanceof File ? file : new File([file], name, { type: file.type });
  form.append("file", f);
  form.append("bucket", bucket);
  form.append("path", path);
  const { data, error } = await supabase.functions.invoke("r2-upload", { body: form });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  if (!data?.publicUrl) throw new Error("Upload failed: no URL returned");
  return data.publicUrl as string;
}

export async function uploadCompressedVideo(
  file: File,
  opts: VideoUploadOptions,
): Promise<VideoUploadResult> {
  const maxDur = opts.maxDurationSec ?? 60;
  const maxBytes = opts.maxRawBytes ?? 100 * 1024 * 1024;

  if (!file.type.startsWith("video/")) throw new Error("Please choose a video file");
  if (file.size > maxBytes) throw new Error(`Video must be under ${Math.round(maxBytes / 1024 / 1024)}MB`);

  const duration = await getDuration(file);
  if (duration > maxDur + 1) {
    throw new Error(`Video must be under ${maxDur} seconds (yours is ${Math.round(duration)}s)`);
  }

  const ffmpeg = await loadFfmpeg(opts.onStage);
  const { fetchFile } = await import("@ffmpeg/util");

  opts.onStage?.("compressing");

  const inputName = "in" + (file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".mp4");
  const outName = "out.mp4";
  const posterName = "poster.jpg";

  // Wire progress
  const progHandler = ({ progress }: { progress: number }) => {
    // ffmpeg progress can briefly exceed 1; clamp
    const p = Math.max(0, Math.min(1, progress));
    opts.onProgress?.(p);
  };
  try {
    (ffmpeg as any).on?.("progress", progHandler);

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Transcode: H.264 720p CRF 26, AAC 96k mono, +faststart, hard cap to maxDur
    await ffmpeg.exec([
      "-i", inputName,
      "-t", String(maxDur),
      "-vf", "scale='min(720,iw)':-2",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "26",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "96k",
      "-ac", "1",
      "-movflags", "+faststart",
      "-y", outName,
    ]);

    // Extract first-frame poster
    await ffmpeg.exec([
      "-i", outName,
      "-ss", "0",
      "-frames:v", "1",
      "-vf", "scale='min(720,iw)':-2",
      "-q:v", "5",
      "-y", posterName,
    ]);

    const videoBytes = (await ffmpeg.readFile(outName)) as Uint8Array;
    const posterBytes = (await ffmpeg.readFile(posterName)) as Uint8Array;

    // Cleanup virtual FS
    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outName); } catch {}
    try { await ffmpeg.deleteFile(posterName); } catch {}

    opts.onStage?.("uploading-video");
    const videoBlob = new Blob([videoBytes], { type: "video/mp4" });
    const videoPath = genPath(opts.userId, opts.storeId, "mp4");
    const videoUrl = await uploadToR2(videoBlob, "video.mp4", "product-videos", videoPath);

    opts.onStage?.("uploading-poster");
    const posterBlob = new Blob([posterBytes], { type: "image/jpeg" });
    const posterPath = genPath(opts.userId, opts.storeId, "jpg");
    const posterUrl = await uploadToR2(posterBlob, "poster.jpg", "product-videos", posterPath);

    return {
      videoUrl,
      posterUrl,
      originalBytes: file.size,
      compressedBytes: videoBytes.byteLength,
    };
  } finally {
    try { (ffmpeg as any).off?.("progress", progHandler); } catch {}
  }
}
