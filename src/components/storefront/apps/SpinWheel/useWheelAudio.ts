import { useRef, useCallback } from "react";

export function useWheelAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!enabled) return null;
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      try {
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        if (!AC) return null;
        ctxRef.current = new AC();
      } catch {
        return null;
      }
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  };

  const tick = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    bp.Q.value = 4;
    osc.type = "square";
    osc.frequency.setValueAtTime(1600, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    osc.connect(bp).connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }, [enabled]);

  const playChord = (freqs: number[], durs: number[], vol = 0.22) => {
    const ctx = getCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const start = t0 + i * 0.09;
      const dur = durs[i] ?? 0.35;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(start + dur + 0.05);
    });
  };

  const win = useCallback(() => {
    playChord([523.25, 659.25, 783.99, 1046.5], [0.35, 0.35, 0.4, 0.6], 0.22);
  }, [enabled]);

  const lose = useCallback(() => {
    playChord([392, 329.63, 261.63], [0.35, 0.35, 0.5], 0.16);
  }, [enabled]);

  return { tick, win, lose };
}
