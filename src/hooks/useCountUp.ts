import { useState, useEffect, useRef } from "react";

/**
 * Animated number.
 *
 * The first time a real value arrives we count up from 0. After that we tween
 * from the *previous* value to the new one, so a background refetch or realtime
 * update nudges the number instead of rolling it back to zero and replaying the
 * whole animation (which made revenue unreadable for a second on every refresh).
 */
export function useCountUp(end: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const currentRef = useRef(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const from = currentRef.current;

    if (end === from) return;

    if (end === 0) {
      currentRef.current = 0;
      setValue(0);
      return;
    }

    fromRef.current = from;
    startTime.current = null;

    const animate = (ts: number) => {
      if (!startTime.current) startTime.current = ts;
      const progress = Math.min((ts - startTime.current) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(fromRef.current + (end - fromRef.current) * eased);
      currentRef.current = next;
      setValue(next);
      if (progress < 1) rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [end, duration]);

  return value;
}
