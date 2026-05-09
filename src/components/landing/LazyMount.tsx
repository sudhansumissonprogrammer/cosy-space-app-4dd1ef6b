import { useEffect, useRef, useState, type ReactNode } from "react";

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
  rootMargin = "600px 0px",
  fallback = null,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
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
    return () => obs.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : fallback}
    </div>
  );
}
