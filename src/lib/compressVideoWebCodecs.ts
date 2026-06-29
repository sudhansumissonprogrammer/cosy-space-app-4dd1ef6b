/**
 * compressVideoWebCodecs — in-browser video re-encoding via WebCodecs + mp4-muxer.
 *
 * Target preset (Storivo "Safe"): 1080p cap, H.264 @ 3.5 Mbps, AAC ~96kbps mono.
 * Falls back to the original file if WebCodecs isn't available or anything throws.
 */
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export interface CompressOptions {
  /** Long-edge cap in pixels (default 1080) */
  maxDimension?: number;
  /** Target video bitrate in bits/s (default 3.5 Mbps) */
  videoBitrate?: number;
  /** Target audio bitrate in bits/s (default 96k) */
  audioBitrate?: number;
  /** Keep audio (default true) */
  keepAudio?: boolean;
  /** Progress callback 0..1 */
  onProgress?: (p: number) => void;
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  durationSec: number;
}

export function isWebCodecsSupported(): boolean {
  return (
    typeof (globalThis as any).VideoEncoder === "function" &&
    typeof (globalThis as any).VideoDecoder === "function" &&
    typeof (globalThis as any).VideoFrame === "function"
  );
}

async function probe(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onloadedmetadata = () => {
      const r = {
        duration: v.duration || 0,
        width: v.videoWidth || 0,
        height: v.videoHeight || 0,
      };
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video"));
    };
  });
}

function fitDims(w: number, h: number, maxDim: number) {
  if (!w || !h) return { w: 1280, h: 720 };
  const long = Math.max(w, h);
  if (long <= maxDim) {
    // Encoders prefer even dimensions.
    return { w: w - (w % 2), h: h - (h % 2) };
  }
  const scale = maxDim / long;
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  return { w: nw - (nw % 2), h: nh - (nh % 2) };
}

export async function compressVideo(file: File, opts: CompressOptions = {}): Promise<CompressResult> {
  if (!isWebCodecsSupported()) {
    throw new Error("WebCodecs not supported");
  }

  const maxDim = opts.maxDimension ?? 1080;
  const videoBitrate = opts.videoBitrate ?? 3_500_000;
  const audioBitrate = opts.audioBitrate ?? 96_000;
  const keepAudio = opts.keepAudio !== false;

  const meta = await probe(file);
  const { w: targetW, h: targetH } = fitDims(meta.width, meta.height, maxDim);
  const durationSec = meta.duration || 0;

  // Decode via HTMLVideoElement + drawImage into VideoFrame.
  // This is the most compatible path (no MP4 demuxer dependency).
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await new Promise<void>((res, rej) => {
    video.onloadeddata = () => res();
    video.onerror = () => rej(new Error("video load failed"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas ctx unavailable");

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: targetW, height: targetH },
    audio: keepAudio ? { codec: "aac", sampleRate: 44100, numberOfChannels: 1 } : undefined,
    fastStart: "in-memory",
  });

  const VideoEncoderCtor: any = (globalThis as any).VideoEncoder;
  const VideoFrameCtor: any = (globalThis as any).VideoFrame;

  const encoder = new VideoEncoderCtor({
    output: (chunk: any, metaOut: any) => muxer.addVideoChunk(chunk, metaOut),
    error: (e: any) => console.error("encoder", e),
  });

  encoder.configure({
    codec: "avc1.42E01F", // H.264 Baseline 3.1 (widely compatible)
    width: targetW,
    height: targetH,
    bitrate: videoBitrate,
    framerate: 30,
    avc: { format: "avc" },
  });

  const fps = 30;
  const frameInterval = 1 / fps;
  const totalFrames = Math.max(1, Math.floor(durationSec * fps));

  for (let i = 0; i < totalFrames; i++) {
    const t = i * frameInterval;
    await new Promise<void>((res) => {
      const onSeek = () => {
        video.removeEventListener("seeked", onSeek);
        res();
      };
      video.addEventListener("seeked", onSeek);
      try {
        video.currentTime = Math.min(t, durationSec - 0.001);
      } catch {
        res();
      }
    });
    ctx.drawImage(video, 0, 0, targetW, targetH);
    const frame = new VideoFrameCtor(canvas, { timestamp: Math.round(t * 1_000_000) });
    const keyFrame = i % 60 === 0;
    encoder.encode(frame, { keyFrame });
    frame.close();
    if (opts.onProgress) opts.onProgress(Math.min(0.95, i / totalFrames));
    // Yield to UI thread occasionally
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  encoder.close();
  URL.revokeObjectURL(url);

  muxer.finalize();
  const buffer = (muxer.target as ArrayBufferTarget).buffer;
  const blob = new Blob([buffer], { type: "video/mp4" });

  opts.onProgress?.(1);

  return {
    blob,
    width: targetW,
    height: targetH,
    durationSec,
  };
}
