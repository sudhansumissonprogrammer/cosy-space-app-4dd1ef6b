import { useEffect, useRef } from "react";

/**
 * Observes a grid container and staggers the reveal of `.stagger-item` children.
 * Re-observes when new children appear (infinite scroll safe).
 */
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      (entries) => {
        // Group newly visible items and stagger them
        const visible = entries.filter((e) => e.isIntersecting);
        visible.forEach((entry, i) => {
          const htmlEl = entry.target as HTMLElement;
          if (reducedMotion) {
            htmlEl.classList.add("stagger-visible");
          } else {
            htmlEl.style.transitionDelay = `${i * 60}ms`;
            requestAnimationFrame(() => {
              htmlEl.classList.add("stagger-visible");
            });
          }
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "50px", threshold: 0.1 }
    );

    // Observe all current stagger-item children
    const observeChildren = () => {
      el.querySelectorAll(".stagger-item:not(.stagger-visible)").forEach((child) => {
        observer.observe(child);
      });
    };

    observeChildren();

    // Watch for new children (infinite scroll)
    const mutationObs = new MutationObserver(() => observeChildren());
    mutationObs.observe(el, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObs.disconnect();
    };
  }, []);

  return ref;
}
