import { useEffect, useRef, useState } from "react";

/** Hold network-bearing children until their reserved frame is visible. */
export function useImageActivation(priority = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(priority);
  useEffect(() => {
    if (priority) { setActive(true); return; }
    if (active) return;
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) { setActive(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setActive(true); observer.disconnect(); }
    }, { rootMargin: "0px", threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, priority]);
  return { ref, active };
}