import { useEffect } from "react";
import { useImageActivation } from "./useImageActivation";
import { subscribeMobileCard } from "./mobileCardReadiness";

/** Shared by all current/future storefront product cards, not the PDP gallery. */
export function useMobileCardActivation(priority = false, desktopAhead = false, enabled = true) {
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const activation = useImageActivation(priority, !mobile && desktopAhead
    ? { rootMargin: "600px 0px", afterScroll: true, afterReady: true } : {});
  const { ref, active } = activation;
  // useImageActivation owns sticky state; mobile preparation dispatches through
  // its shared activation subscription rather than creating a second source gate.
  useEffect(() => {
    if (!enabled || !mobile || active || !ref.current || !("IntersectionObserver" in window)) return;
    return subscribeMobileCard(ref.current, () => {
      ref.current?.dispatchEvent(new Event("storefront:prepare-card"));
    });
  }, [enabled, mobile, active, ref]);
  return { ...activation, mobile };
}