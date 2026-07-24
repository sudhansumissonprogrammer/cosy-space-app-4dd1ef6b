import { useLocation, useNavigationType } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Wraps storefront page content with a fade-in animation on route change.
 *
 * IMPORTANT: We skip the animation on POP (browser back/forward). Meesho /
 * Flipkart-style back navigation must feel instant — a 300ms fade layered on
 * top of the scroll-restore work makes back-from-PDP feel laggy on mid-tier
 * Android. Fresh forward navigations (PUSH) still get the fade for polish.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const animate = navType === "PUSH";

  return (
    <div
      key={pathname}
      className={animate ? "animate-[page-fade-in_0.3s_ease-out_both]" : undefined}
    >
      {children}
    </div>
  );
}
