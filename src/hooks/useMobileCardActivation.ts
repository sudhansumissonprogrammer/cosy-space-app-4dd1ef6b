import { useEffect, useRef } from "react";
import { useImageActivation } from "./useImageActivation";
import { subscribeMobileCard } from "./mobileCardReadiness";

/** Shared by all current/future storefront product cards, not the PDP gallery. */
export function useMobileCardActivation(priority = false, desktopAhead = false, enabled = true) {
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const activation = useImageActivation(priority, !mobile && desktopAhead
    ? { rootMargin: "600px 0px", afterScroll: true, afterReady: true } : {});
  const { ref } = activation;
  const activateRef = useRef(activation.activate);
  activateRef.current = activation.activate;
  // Both observers earn the same sticky activation; no second image source gate.
  useEffect(() => {
    if (!enabled || !mobile || priority || !ref.current || !("IntersectionObserver" in window)) return;
    return subscribeMobileCard(ref.current, () => activateRef.current());
  }, [enabled, mobile, priority, ref]);
  return { ...activation, mobile };
}