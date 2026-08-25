import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  rootMargin?: string;
  /** Fallback delay (ms) after mount if IntersectionObserver unavailable */
  fallbackDelay?: number;
  minHeight?: number | string;
}

/**
 * Renders children only once the placeholder scrolls within `rootMargin`
 * of the viewport. Used to defer heavy below-the-fold sections (Related
 * products, FBT) so their data fetches don't compete with the LCP image.
 */
export function DeferUntilVisible({
  children,
  rootMargin = "400px",
  fallbackDelay = 2500,
  minHeight = 200,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setShow(true), fallbackDelay);
      return () => clearTimeout(t);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    // Safety net: ONLY mount blind if the placeholder has no measurable box
    // (zero-height parent → the observer can never fire). Previously this
    // timer mounted every deferred section ~2.5s after load even when the
    // shopper never scrolled, so below-fold carousels/reviews still fired
    // their queries on every PDP.
    const t = setTimeout(() => {
      const box = ref.current?.getBoundingClientRect();
      if (!box || (box.height === 0 && box.width === 0)) setShow(true);
    }, fallbackDelay);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, [show, rootMargin, fallbackDelay]);


  if (show) return <>{children}</>;
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" />;
}

export default DeferUntilVisible;
