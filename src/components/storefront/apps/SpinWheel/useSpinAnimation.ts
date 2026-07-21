import { useEffect, useRef, useState } from "react";

const ease = (t: number) => 1 - Math.pow(1 - t, 5);

interface Opts {
  targetDelta: number;
  duration: number;
  sliceCount: number;
  active: boolean;
  onTick?: () => void;
  onDone?: () => void;
}

export function useSpinAnimation({ targetDelta, duration, sliceCount, active, onTick, onDone }: Opts) {
  const [rotation, setRotation] = useState(0);
  const startRef = useRef(0);
  const fromRef = useRef(0);
  const lastSliceRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    startRef.current = performance.now();
    fromRef.current = rotation;
    const sliceAngle = 360 / Math.max(1, sliceCount);
    lastSliceRef.current = Math.floor(rotation / sliceAngle);
    doneRef.current = false;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const current = fromRef.current + targetDelta * ease(t);
      setRotation(current);
      const idx = Math.floor(current / sliceAngle);
      if (idx !== lastSliceRef.current) {
        lastSliceRef.current = idx;
        onTick?.();
      }
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, targetDelta, duration, sliceCount]);

  return rotation;
}
