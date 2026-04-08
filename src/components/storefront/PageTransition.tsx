import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Wraps storefront page content with a fade-in animation on route change.
 * Uses CSS `animation` keyed to the current pathname.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div
      key={pathname}
      className="animate-[page-fade-in_0.3s_ease-out_both]"
    >
      {children}
    </div>
  );
}
