import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Defers mounting (and therefore the lazy-imported chunk download) of a
 * below-fold landing section until it's about to scroll into view.
 *
 * Critical: each section is wrapped individually so React.lazy chunks load
 * progressively as the user scrolls, instead of all at once on first paint.
 */
interface LazyMountProps {
  children: ReactNode;
  /** Reserve vertical space to avoid CLS while not yet mounted */
  minHeight?: number;
  rootMargin?: string;
  fallback?: ReactNode;
}

export default function LazyMount({
  children,
  minHeight = 400,
  rootMargin = "2000px 0px",
  fallback = null,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) {
      // No ref yet — schedule idle mount as safety net
      const idle: any = (window as any).requestIdleCallback;
      const h = idle ? idle(() => setVisible(true), { timeout: 2500 }) : setTimeout(() => setVisible(true), 1500);
      return () => { idle ? (window as any).cancelIdleCallback?.(h) : clearTimeout(h); };
    }
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);

    // Safety net: after the browser is idle, mount everything regardless of
    // scroll position. This eliminates the "white-then-content" flash users
    // saw when scrolling fast — chunks are already downloaded & rendered.
    const idle: any = (window as any).requestIdleCallback;
    const handle = idle
      ? idle(() => { setVisible(true); obs.disconnect(); }, { timeout: 3000 })
      : window.setTimeout(() => { setVisible(true); obs.disconnect(); }, 1800);

    return () => {
      obs.disconnect();
      if (idle && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(handle);
      else clearTimeout(handle as any);
    };
  }, [rootMargin, visible]);

  // Keep `minHeight` applied even after the section mounts. It acts as a
  // *floor* — real content taller than the reservation renders unchanged,
  // but if the rendered section ends up shorter than what we reserved, the
  // page height does NOT shrink. This prevents the browser from snapping
  // scroll position upward (the "auto-scrolling to top" bug) every time a
  // below-fold section becomes visible while the user is reading.
  return (
    <div ref={ref} style={{ minHeight }}>
      {visible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
}
