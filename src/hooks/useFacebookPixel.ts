import { useEffect, useCallback } from "react";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: any;
  }
}

/**
 * Initialize fbq shim SYNCHRONOUSLY so events queued before
 * the real script loads are never dropped.
 */
function ensureFbqShim() {
  if (typeof window === "undefined") return;
  const f: any = window;
  if (f.fbq) return; // already initialised
  const q: any = function (...args: any[]) {
    q.callMethod ? q.callMethod.apply(q, args) : q.queue.push(args);
  };
  if (!f._fbq) f._fbq = q;
  q.push = q;
  q.loaded = true;
  q.version = "2.0";
  q.queue = [];
  f.fbq = q;
}

// Run once on module load — ensures shim exists before any event fires
ensureFbqShim();

/**
 * Inject Facebook Pixel base code and fire PageView.
 * The fbq shim is already created synchronously at module load,
 * so events queued via fbPixelTrack() before the script loads
 * are buffered and flushed automatically.
 */
export function useFacebookPixel(pixelId: string | null | undefined) {
  useEffect(() => {
    if (!pixelId) return;

    // Don't inject twice
    if (document.getElementById("fb-pixel-script")) return;

    // Defer actual script loading to idle time — events are queued by shim
    const schedule =
      typeof requestIdleCallback !== "undefined"
        ? (cb: () => void) => requestIdleCallback(cb, { timeout: 4000 })
        : (cb: () => void) => setTimeout(cb, 2000);

    schedule(() => {
      if (document.getElementById("fb-pixel-script")) return;

      const script = document.createElement("script");
      script.id = "fb-pixel-script";
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);

      // noscript pixel — must go in <body> per HTML5 spec
      const noscript = document.createElement("noscript");
      noscript.id = "fb-pixel-noscript";
      const img = document.createElement("img");
      img.height = 1;
      img.width = 1;
      img.style.display = "none";
      img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
      noscript.appendChild(img);
      document.body.appendChild(noscript);
    });

    // Init + PageView fire immediately via shim (queued until script loads)
    window.fbq("init", pixelId);
    window.fbq("track", "PageView");

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

/** Generate a unique event ID for pixel↔CAPI deduplication */
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Standalone helper — call from anywhere (e.g. CartContext) */
export function fbPixelTrack(eventName: string, params?: Record<string, any>, eventId?: string) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    if (eventId) {
      window.fbq("track", eventName, params, { eventID: eventId });
    } else {
      window.fbq("track", eventName, params);
    }
  }
}
