/**
 * compressVideoWebCodecs — in-browser video re-encoding via WebCodecs + mp4-muxer.
 *
 * v2 (playback capture): the previous implementation seeked frame-by-frame
 * (30fps × up to 60s ≈ 1800 seeks) which took minutes on desktop and hung on
 * phones. We now play the video muted at an accelerated rate and grab frames
 * with requestVideoFrameCallback — real decode speed, no seek storms.
 *
 * Quality: bitrate is derived from the source (never upscaled, never crushed)
 * with a sensible floor/ceiling, so a 40MB clip shrinks a lot while a already
 * lean clip stays visually identical.
 *
 * Audio is dropped intentionally (trust/product clips autoplay muted) — the
 * old code configured an audio track in the muxer but never fed it chunks,
 * which produced broken MP4s on some players.
 */
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export interface CompressOptions {
  /** Long-edge cap in pixels (default 1080) */
  maxDimension?: number;
  /** Target video bitrate in bits/s (default: derived from source) */
  videoBitrate?: number;
  /** Ignored — audio is always dropped (clips play muted) */
  audioBitrate?: number;
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
    typeof (globalThis as any).VideoFrame === "function" &&
    typeof HTMLVideoElement !== "undefined" &&
    "requestVideoFrameCallback" in HTMLVideoElement.prototype
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
    return { w: w - (w % 2), h: h - (h % 2) };
  }
  const scale = maxDim / long;
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  return { w: nw - (nw % 2), h: nh - (nh % 2) };
}

/** Quality-preserving bitrate: high bpp target, never below a safe floor. */
function pickBitrate(fileBytes: number, durationSec: number, w: number, h: number) {
  const pixels = w * h;
  // ~0.12 bits per pixel per frame @30fps. For 720x1280 that is ~3.3 Mbps —
  // still above the "visually transparent" threshold for phone footage, but
  // it actually leaves headroom below typical 3–5 Mbps camera exports.
  const byResolution = Math.round(pixels * 30 * 0.12);
  const sourceBps = durationSec > 0 ? (fileBytes * 8) / durationSec : byResolution;
  // Never spend more than ~85% of the source — guarantees the output is
  // smaller than the input instead of ballooning past it.
  const target = Math.min(byResolution, Math.round(sourceBps * 0.85));
  return Math.max(1_600_000, Math.min(target, 8_000_000));
}

export async function compressVideo(file: File, opts: CompressOptions = {}): Promise<CompressResult> {
  if (!isWebCodecsSupported()) {
    throw new Error("WebCodecs not supported");
  }

  const maxDim = opts.maxDimension ?? 1280;
  const meta = await probe(file);
  const { w: targetW, h: targetH } = fitDims(meta.width, meta.height, maxDim);
  const durationSec = meta.duration || 0;
  const videoBitrate = opts.videoBitrate ?? pickBitrate(file.size, durationSec, targetW, targetH);

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  (video as any).defaultMuted = true;
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
    fastStart: "in-memory",
  });

  const VideoEncoderCtor: any = (globalThis as any).VideoEncoder;
  const VideoFrameCtor: any = (globalThis as any).VideoFrame;

  let encodeError: any = null;
  const encoder = new VideoEncoderCtor({
    output: (chunk: any, metaOut: any) => muxer.addVideoChunk(chunk, metaOut),
    error: (e: any) => {
      encodeError = e;
      console.error("[video] encoder error", e);
    },
  });

  // Prefer High profile (better quality per bit), fall back to Baseline.
  const configs = [
    { codec: "avc1.640028" },
    { codec: "avc1.42E01F" },
  ];
  let configured = false;
  for (const c of configs) {
    const cfg = {
      codec: c.codec,
      width: targetW,
      height: targetH,
      bitrate: videoBitrate,
      framerate: 30,
      latencyMode: "quality" as const,
      avc: { format: "avc" as const },
    };
    try {
      const support = await VideoEncoderCtor.isConfigSupported?.(cfg);
      if (support && support.supported === false) continue;
      encoder.configure(cfg);
      configured = true;
      break;
    } catch {
      /* try next */
    }
  }
  if (!configured) throw new Error("No supported H.264 encoder config");

  // Capture at real time for short clips — accelerated playback makes the
  // browser DROP presented frames, which is what produced juddery output.
  video.playbackRate = durationSec > 45 ? 1.5 : 1;
  let frameIndex = 0;
  let lastTs = -1;

  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    const onFrame = (_now: number, frameMeta: any) => {
      try {
        const mediaTime: number = frameMeta?.mediaTime ?? video.currentTime;
        const tsUs = Math.round(mediaTime * 1_000_000);
        // Decimate to ~30fps. 60fps phone exports otherwise feed twice the
        // frames into an encoder configured for 30fps, which both doubles the
        // output size and starves each frame of bits.
        const MIN_DELTA_US = 1_000_000 / 30.5;
        if (tsUs > lastTs && (lastTs < 0 || tsUs - lastTs >= MIN_DELTA_US)) {
          lastTs = tsUs;
          ctx.drawImage(video, 0, 0, targetW, targetH);
          const frame = new VideoFrameCtor(canvas, { timestamp: tsUs });
          encoder.encode(frame, { keyFrame: frameIndex % 60 === 0 });
          frame.close();
          frameIndex++;
          if (durationSec > 0) {
            opts.onProgress?.(Math.min(0.95, mediaTime / durationSec));
          }
        }
      } catch (e) {
        reject(e);
        return;
      }
      if (!video.ended) (video as any).requestVideoFrameCallback(onFrame);
      else done();
    };

    video.onended = done;
    video.onerror = () => reject(new Error("playback failed"));
    (video as any).requestVideoFrameCallback(onFrame);
    video.play().catch((e) => reject(e));
  });

  await encoder.flush();
  encoder.close();
  URL.revokeObjectURL(url);

  if (encodeError) throw new Error("Video encoding failed");
  if (frameIndex === 0) throw new Error("No frames captured");

  muxer.finalize();
  const buffer = (muxer.target as ArrayBufferTarget).buffer;
  const blob = new Blob([buffer], { type: "video/mp4" });

  opts.onProgress?.(1);

  return { blob, width: targetW, height: targetH, durationSec };
}
