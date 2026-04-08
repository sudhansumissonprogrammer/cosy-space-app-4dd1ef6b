import { useEffect, useRef } from "react";

/**
 * Initializes Lenis smooth scroll on the storefront.
 * Only activates on devices that can benefit (no-preference for reduced-motion,
 * non-touch primary input). Auto-cleans up on unmount.
 */
export function useLenis() {
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    // Respect reduced-motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf: number;
    let lenis: any;

    import("lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        touchMultiplier: 1.5,
        infinite: false,
      });
      instanceRef.current = lenis;

      function loop(time: number) {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (lenis) lenis.destroy();
      instanceRef.current = null;
    };
  }, []);

  return instanceRef;
}
