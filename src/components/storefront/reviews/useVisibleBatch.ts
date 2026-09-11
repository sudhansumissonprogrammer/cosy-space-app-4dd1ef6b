import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Progressive rendering helper for long review lists.
 *
 * Reviews are cheap as JSON but expensive as DOM (each card mounts an image or
 * a <video>). Rendering 30–100 cards at once on a PDP or inside the checkout
 * sheet costs main-thread time and fires dozens of media requests. This hook
 * renders `step` cards first and grows the window only when a sentinel element
 * scrolls into view, so nothing beyond the fold is ever fetched or laid out.
 */
export function useVisibleBatch(total: number, step = 8) {
  const [count, setCount] = useState(() => Math.min(step, total));
  const sentinel = useRef<HTMLDivElement | null>(null);

  // Reset when the underlying list changes size (store switch, refetch).
  useEffect(() => {
    setCount((c) => Math.min(Math.max(c, Math.min(step, total)), total));
  }, [total, step]);

  const attach = useCallback((node: HTMLDivElement | null) => {
    sentinel.current = node;
  }, []);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || count >= total) return;
    if (typeof IntersectionObserver === "undefined") {
      setCount(total);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => Math.min(c + step, total));
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [count, total, step]);

  return { count, attach, done: count >= total };
}
