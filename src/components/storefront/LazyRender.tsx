import { useRef, useState, useEffect, type ReactNode } from "react";

interface LazyRenderProps {
  children: ReactNode;
  /** Placeholder height to prevent layout shift */
  minHeight?: number;
  /** Root margin for IntersectionObserver */
  rootMargin?: string;
  className?: string;
}

/**
 * Defers rendering of children until the element is near the viewport.
 * Prevents rendering 60+ product cards on initial paint.
 */
export default function LazyRender({
  children,
  minHeight = 320,
  rootMargin = "1200px",
  className,
}: LazyRenderProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Render immediately on mount so images can start downloading in parallel
  // with the hero / above-the-fold content. The IntersectionObserver-based
  // deferral was causing first-load product images to appear blank until the
  // user scrolled or refreshed (browser cache hit). With external CDNs like
  // overlaysnow.com we want fetches to start ASAP — no benefit to waiting.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return (
    <div
      ref={ref}
      className={`${className || ""} ${!visible ? "storefront-below-fold" : ""}`.trim()}
      style={visible ? undefined : { minHeight }}
    >
      {visible ? children : null}
    </div>
  );
}
