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
  rootMargin = "100px",
  className,
}: LazyRenderProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Reserve a frame and mount near-visible content; distant sections must
  // not compete with opening-screen photos merely because they exist.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }

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
