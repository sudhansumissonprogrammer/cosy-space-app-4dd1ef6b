import { useEffect, useRef, useState, useCallback } from "react";

interface Options {
  onRefresh: () => Promise<unknown> | void;
  threshold?: number;
  /** Disable on desktop. Default true. */
  mobileOnly?: boolean;
}

/**
 * Lightweight pull-to-refresh. Returns props to spread on a wrapper element
 * plus current pull distance and refreshing state for indicator UI.
 *
 * Activates only when scrolled to top (window.scrollY === 0).
 */
export function usePullToRefresh({ onRefresh, threshold = 70, mobileOnly = true }: Options) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const isMobile =
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const enabled = !mobileOnly || isMobile;

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || refreshing) return;
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    },
    [enabled, refreshing],
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Resistive curve — feels native
      const resisted = Math.min(threshold * 1.6, dy * 0.55);
      setPull(resisted);
    },
    [refreshing, threshold],
  );

  const onTouchEnd = useCallback(async () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= threshold && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 300);
      }
    } else {
      setPull(0);
    }
  }, [pull, threshold, refreshing, onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, onTouchStart, onTouchMove, onTouchEnd]);

  return { pull, refreshing, enabled };
}
