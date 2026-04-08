import { useEffect, useRef } from "react";

/**
 * Observes a grid container and staggers the reveal of its children.
 * Each child gets a CSS class `stagger-visible` with an incremental delay.
 * Returns a ref to attach to the grid container.
 */
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // If reduced motion, just show everything immediately
      el.querySelectorAll(".stagger-item").forEach((child) => {
        (child as HTMLElement).classList.add("stagger-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const children = entry.target.querySelectorAll(".stagger-item:not(.stagger-visible)");
            children.forEach((child, i) => {
              const htmlChild = child as HTMLElement;
              htmlChild.style.transitionDelay = `${i * 60}ms`;
              // Use rAF to batch style changes
              requestAnimationFrame(() => {
                htmlChild.classList.add("stagger-visible");
              });
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "50px", threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
