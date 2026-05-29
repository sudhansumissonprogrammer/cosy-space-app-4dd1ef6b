import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Returns `visible` — true when header should show, false when hidden.
 * Header hides on scroll-down (after 60px threshold), shows on scroll-up.
 * Always visible when near top of page (< 80px).
 */
export function useSmartHeader() {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const { pathname } = useLocation();

  useEffect(() => {
    lastY.current = window.scrollY;
    setVisible(true);
  }, [pathname]);

  useEffect(() => {
    const restore = () => {
      lastY.current = window.scrollY;
      if (window.scrollY < 120) setVisible(true);
    };
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", restore);
    return () => {
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", restore);
    };
  }, []);

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
