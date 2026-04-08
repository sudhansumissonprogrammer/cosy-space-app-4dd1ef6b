import { useEffect, useRef } from "react";

/**
 * Thin scroll progress bar at the top of the page.
 * Uses transform: scaleX() for GPU-composited, zero-layout-cost animation.
 */
export default function ScrollProgressBar() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) { ticking = false; return; }
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
        el.style.transform = `scaleX(${progress})`;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <div ref={ref} className="scroll-progress-bar" style={{ transform: "scaleX(0)" }} />;
}
