import { useEffect, useCallback } from "react";
import { getOrCreateSfVid } from "@/lib/metaEnrichment";


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
/**
 * Returns true when running on a Lovable preview/editor/dev domain.
 * Pixel + CAPI must NOT fire there — only on real customer-facing
 * custom domains (e.g. serdiyajewellers.shop) or *.lovable.app published URLs.
 */
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

export function useFacebookPixel(pixelId: string | null | undefined) {
  useEffect(() => {
    if (!pixelId) return;
    if (isNonProductionHost()) return;

    // Phase 1: If index.html inline script already initialized this pixel,
    // skip — avoids duplicate init + duplicate PageView.
    const alreadyInited = (window as any).__SF_PIXEL_INITED__ === pixelId;

    // Don't inject twice
    if (document.getElementById("fb-pixel-script") && alreadyInited) return;

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

      // NOTE: We deliberately do NOT inject a <noscript><img/></noscript>
      // fallback here. The fallback's purpose is to fire PageView when
      // JavaScript is disabled — but if we got here, JS is running and
      // the real fbq pixel above already fired PageView. Worse, when a
      // <noscript> is inserted via JS, Chromium parses its content and
      // STILL fetches the img inside, producing a duplicate PageView
      // (one with `&noscript=1`, one without). That duplicates events
      // in Events Manager, dilutes EMQ and inflates reported traffic.
      // The only correct place for the <noscript> fallback would be
      // inside the server-rendered <body> in index.html (so the browser
      // ignores it when JS runs) — not injected from a React hook.
    });

    // Init + PageView fire immediately via shim (queued until script loads)
    // — but skip if inline script already did it (avoids double PageView).
    if (!alreadyInited) {
      window.fbq("init", pixelId);
      window.fbq("track", "PageView");
      (window as any).__SF_PIXEL_INITED__ = pixelId;
    }

    return () => {
      document.getElementById("fb-pixel-script")?.remove();
    };
  }, [pixelId]);

  const trackEvent = useCallback(
    (eventName: string, params?: Record<string, any>, eventId?: string) => {
      if (!pixelId || typeof window.fbq !== "function") return;
      if (eventId) {
        window.fbq("track", eventName, params, { eventID: eventId });
      } else {
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
  if (typeof window === "undefined") return;
  if (isNonProductionHost()) return;
  if (typeof window.fbq === "function") {
    if (eventId) {
      window.fbq("track", eventName, params, { eventID: eventId });
    } else {
      window.fbq("track", eventName, params);
    }
  }
}
