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
  // ~0.22 bits per pixel per frame @30fps — visually transparent for phone
  // footage (1080x1920 ≈ 13.7 Mbps, capped below). Previously 0.12 bpp, which
  // visibly softened detail on jewellery/product clips.
  const byResolution = Math.round(pixels * 30 * 0.22);
  const sourceBps = durationSec > 0 ? (fileBytes * 8) / durationSec : byResolution;
  // Never spend more than the source bitrate (no point inflating), but stay
  // close to it so quality is preserved rather than crushed.
  const target = Math.min(byResolution, Math.round(sourceBps * 0.95));
  return Math.max(3_000_000, Math.min(target, 14_000_000));
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

  // ALWAYS capture at 1x. Accelerated playback (the old `durationSec > 45`
  // path) makes the compositor DROP presented frames: a 53s clip came out at
  // ~8fps, which is exactly the "lagging"/juddery playback merchants saw.
  video.playbackRate = 1;
  let frameIndex = 0;
  let lastTs = -1;

  // Prefer MediaStreamTrackProcessor: it pulls real decoded frames off the
  // track instead of relying on rendered frames, so background tabs / slow
  // paint don't silently drop motion. Falls back to rVFC + canvas.
  const TrackProcessor: any = (globalThis as any).MediaStreamTrackProcessor;
  const canUseProcessor =
    typeof TrackProcessor === "function" && typeof (video as any).captureStream === "function";

  const MIN_DELTA_US = 1_000_000 / 30.5;
  const pushFrame = (frame: any, tsUs: number) => {
    lastTs = tsUs;
    encoder.encode(frame, { keyFrame: frameIndex % 60 === 0 });
    frameIndex++;
    if (durationSec > 0) opts.onProgress?.(Math.min(0.95, tsUs / 1_000_000 / durationSec));
  };

  if (canUseProcessor) {
    const stream: MediaStream = (video as any).captureStream();
    const track = stream.getVideoTracks()[0];
    const reader = new TrackProcessor({ track }).readable.getReader();
    await video.play();
    const t0 = performance.now();
    try {
      while (true) {
        const { value: frame, done: streamDone } = await reader.read();
        if (streamDone) break;
        if (!frame) continue;
        try {
          const tsUs = frame.timestamp ?? Math.round(video.currentTime * 1_000_000);
          if (tsUs > lastTs && (lastTs < 0 || tsUs - lastTs >= MIN_DELTA_US)) {
            if (frame.displayWidth !== targetW || frame.displayHeight !== targetH) {
              ctx.drawImage(frame, 0, 0, targetW, targetH);
              const scaled = new VideoFrameCtor(canvas, { timestamp: tsUs });
              pushFrame(scaled, tsUs);
              scaled.close();
            } else {
              pushFrame(frame, tsUs);
            }
          }
        } finally {
          frame.close();
        }
        if (video.ended) break;
        // Safety valve: never run longer than 3x realtime.
        if (performance.now() - t0 > (durationSec + 20) * 3000) break;
      }
    } finally {
      try { reader.cancel(); } catch { /* ignore */ }
      try { track.stop(); } catch { /* ignore */ }
    }
  } else {
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
          if (tsUs > lastTs && (lastTs < 0 || tsUs - lastTs >= MIN_DELTA_US)) {
            ctx.drawImage(video, 0, 0, targetW, targetH);
            const frame = new VideoFrameCtor(canvas, { timestamp: tsUs });
            pushFrame(frame, tsUs);
            frame.close();
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
  }

  await encoder.flush();
  encoder.close();
  URL.revokeObjectURL(url);

  if (encodeError) throw new Error("Video encoding failed");
  if (frameIndex === 0) throw new Error("No frames captured");

  // Quality gate: if the capture dropped so many frames that the result would
  // stutter, refuse the re-encode. The caller then uploads the original file,
  // which is always smooth. 18fps is the floor for acceptable motion.
  const capturedFps = durationSec > 0 ? frameIndex / durationSec : 30;
  if (durationSec > 2 && capturedFps < 18) {
    throw new Error(`LOW_FPS_CAPTURE: only ${capturedFps.toFixed(1)}fps captured`);
  }


  muxer.finalize();
  const buffer = (muxer.target as ArrayBufferTarget).buffer;
  const blob = new Blob([buffer], { type: "video/mp4" });

  opts.onProgress?.(1);

  return { blob, width: targetW, height: targetH, durationSec };
}
