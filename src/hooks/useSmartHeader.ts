import { useState, useEffect, useRef } from "react";

/**
 * Returns `visible` — true when header should show, false when hidden.
 * Header hides on scroll-down (after 60px threshold), shows on scroll-up.
 * Always visible when near top of page (< 80px).
 */
export function useSmartHeader() {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80) {
          setVisible(true);
        } else if (y - lastY.current > 8) {
          setVisible(false); // scrolling down
        } else if (lastY.current - y > 4) {
          setVisible(true); // scrolling up
        }
        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return visible;
}
