import { useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    __SF_GA4_INITED__?: string;
  }
}

function isNonProductionHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".sandbox.lovable.dev")
  );
}

/**
 * Lightweight GA4 hook — mirrors useFacebookPixel:
 *  - Inits gtag.js with the per-store measurement ID once
 *  - Fires page_view on every SPA route change (Shopify parity)
 *  - Stores without `features.ga4_measurement_id` set: hook is a no-op
 */
export function useGA4(measurementId: string | null | undefined, pathname: string) {
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!measurementId) return;
    if (isNonProductionHost()) return;
    if (window.__SF_GA4_INITED__ === measurementId) return;

    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer!.push(args);
    }
    (window as any).gtag = gtag;
    gtag("js", new Date());
    // We fire page_view manually on route change → disable auto pageview
    gtag("config", measurementId, { send_page_view: false });
    window.__SF_GA4_INITED__ = measurementId;

    // Defer script load to idle so it doesn't block LCP
    const schedule =
      typeof requestIdleCallback !== "undefined"
        ? (cb: () => void) => requestIdleCallback(cb, { timeout: 4000 })
        : (cb: () => void) => setTimeout(cb, 2000);
    schedule(() => {
      if (document.getElementById("ga4-script")) return;
      const s = document.createElement("script");
      s.id = "ga4-script";
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(s);
    });
  }, [measurementId]);

  // SPA page_view on route change
  useEffect(() => {
    if (!measurementId) return;
    if (isNonProductionHost()) return;
    if (typeof window.gtag !== "function") return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    try {
      window.gtag("event", "page_view", {
        page_path: pathname,
        page_location: window.location.href,
        page_title: document.title,
      });
    } catch {}
  }, [pathname, measurementId]);
}

/** Standalone helper — fire a GA4 event from anywhere */
export function ga4Track(eventName: string, params?: Record<string, any>) {
  if (typeof window === "undefined") return;
  if (isNonProductionHost()) return;
  if (typeof window.gtag !== "function") return;
  try {
    window.gtag("event", eventName, params || {});
  } catch {}
}
