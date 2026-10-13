import { useEffect, useState } from "react";

/** Prepare a bounded ring, not the entire gallery or zoom originals. */
export function useGalleryPreparation(index: number, count: number, ready: boolean) {
  const [activatedSlides, setActivatedSlides] = useState<Set<number>>(() => new Set([0]));
  useEffect(() => {
    if (!ready || count < 2) return;
    setActivatedSlides(previous => {
      const next = (index + 1) % count;
      const prev = (index - 1 + count) % count;
      if (previous.has(next) && previous.has(prev)) return previous;
      return new Set([...previous, next, prev]);
    });
  }, [index, count, ready]);
  return [activatedSlides, setActivatedSlides] as const;
}