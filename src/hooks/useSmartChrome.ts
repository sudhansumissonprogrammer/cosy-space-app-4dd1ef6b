import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * useSmartChrome — universal "smart" scroll behaviour for the storefront
 * header AND the mobile bottom nav.
 *
 * One rAF-throttled scroll listener per mounted consumer (header + nav),
 * transform-only hiding (no layout thrash).
 *
 * Rules:
 *  - Always visible near the top of the page (< 80px)
 *  - Hides on scroll down (> 8px delta), reveals on scroll up (> 4px delta)
 *  - Always visible on checkout routes
 *  - Disabled entirely when the store turned off "auto-hide" — the flag is
 *    published globally by StorefrontShell as
 *    `document.documentElement.dataset.autoHideChrome = "0"`.
 */
function autoHideEnabled(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.dataset.autoHideChrome !== "0";
}

export function useSmartChrome(): { headerVisible: boolean; navVisible: boolean } {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const { pathname } = useLocation();
  const isCheckout = pathname.includes("/checkout");

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
    if (isCheckout) {
      setVisible(true);
      return;
    }

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        ticking.current = false;
        if (!autoHideEnabled()) {
          setVisible(true);
          lastY.current = window.scrollY;
          return;
        }
        // Keep chrome visible while an overlay/drawer owns the screen.
        if (document.body.hasAttribute("data-scroll-locked") || document.body.style.overflow === "hidden") {
          setVisible(true);
          return;
        }
        const y = window.scrollY;
        if (y < 80) {
          setVisible(true);
        } else if (y - lastY.current > 8) {
          setVisible(false);
        } else if (lastY.current - y > 4) {
          setVisible(true);
        }
        lastY.current = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isCheckout]);

  return { headerVisible: visible, navVisible: visible };
}
