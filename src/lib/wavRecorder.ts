/**
 * Microphone → complete 16 kHz mono WAV file.
 *
 * We deliberately do NOT use MediaRecorder: iOS Safari produces fragmented MP4
 * that transcription models reject, and timesliced webm chunks have no header.
 * Web Audio PCM + our own WAV header is decodable everywhere.
 */

type Recorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
  /** 0..1 live input level, for the mic animation */
  level: () => number;
};

function encodeWav(chunks: Float32Array[], inRate: number, outRate = 16000): Blob {
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }

  // Linear downsample to 16 kHz (plenty for speech, keeps the upload small).
  const ratio = inRate / outRate;
  const outLen = Math.floor(merged.length / ratio);
  const samples = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, merged[Math.floor(i * ratio)] || 0));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true);
  view.setUint32(28, outRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(buffer, 44).set(samples);
  return new Blob([buffer], { type: "audio/wav" });
}

/** Reason codes the UI maps to plain-language messages. */
export type MicErrorCode =
  | "insecure"
  | "unsupported"
  | "denied"
  | "embedded_blocked"
  | "no_mic"
  | "in_use"
  | "unknown";

export class MicError extends Error {
  code: MicErrorCode;
  constructor(code: MicErrorCode, message?: string) {
    super(message || code);
    this.code = code;
  }
}

const inIframe = () => {
  try { return window.self !== window.top; } catch { return true; }
};

export async function startWavRecording(): Promise<Recorder> {
  // https:// (or localhost) is required by every browser for the microphone.
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    throw new MicError("insecure");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    // Old in-app browsers (some Instagram/Facebook webviews) simply don't ship it.
    throw new MicError(inIframe() ? "embedded_blocked" : "unsupported");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    const name = (e as DOMException)?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      // Inside an iframe without allow="microphone" the browser denies it
      // instantly without ever prompting — same error name, different fix.
      throw new MicError(inIframe() ? "embedded_blocked" : "denied");
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new MicError("no_mic");
    if (name === "NotReadableError" || name === "AbortError") throw new MicError("in_use");
    throw new MicError("unknown", String((e as Error)?.message || e));
  }
  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let peak = 0;

  node.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    let max = 0;
    for (let i = 0; i < input.length; i += 32) max = Math.max(max, Math.abs(input[i]));
    peak = max;
  };
  source.connect(node);
  node.connect(ctx.destination);

  const teardown = () => {
    try { node.disconnect(); source.disconnect(); } catch { /* already torn down */ }
    stream.getTracks().forEach((t) => t.stop());
    try { ctx.close(); } catch { /* already closed */ }
  };

  return {
    level: () => peak,
    cancel: () => teardown(),
    stop: async () => {
      const rate = ctx.sampleRate;
      teardown();
      return encodeWav(chunks, rate);
    },
  };
}
