import { useEffect, useCallback } from "react";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: any;
  }
}

/**
 * Inject Facebook Pixel base code and fire PageView.
 * Returns a trackEvent helper for standard events.
 */
export function useFacebookPixel(pixelId: string | null | undefined) {
  useEffect(() => {
    if (!pixelId) return;

    // Don't inject twice
    if (document.getElementById("fb-pixel-script")) return;

    // fbq shim
    const f: any = window;
    const n = "fbq";
    if (!f[n]) {
      const q: any = function (...args: any[]) {
        q.callMethod ? q.callMethod.apply(q, args) : q.queue.push(args);
      };
      if (!f._fbq) f._fbq = q;
      q.push = q;
      q.loaded = true;
      q.version = "2.0";
      q.queue = [];
      f[n] = q;
    }

    const script = document.createElement("script");
    script.id = "fb-pixel-script";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");

    // noscript pixel
    const noscript = document.createElement("noscript");
    noscript.id = "fb-pixel-noscript";
    const img = document.createElement("img");
    img.height = 1;
    img.width = 1;
    img.style.display = "none";
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
    noscript.appendChild(img);
    document.head.appendChild(noscript);

    return () => {
      document.getElementById("fb-pixel-script")?.remove();
      document.getElementById("fb-pixel-noscript")?.remove();
    };
  }, [pixelId]);

  const trackEvent = useCallback(
    (eventName: string, params?: Record<string, any>) => {
      if (pixelId && typeof window.fbq === "function") {
        window.fbq("track", eventName, params);
      }
    },
    [pixelId]
  );

  return { trackEvent };
}

/** Standalone helper — call from anywhere (e.g. CartContext) */
export function fbPixelTrack(eventName: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, params);
  }
}
