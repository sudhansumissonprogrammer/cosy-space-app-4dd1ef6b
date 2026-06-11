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

/**
 * Pre-warm the `_fbp` first-party cookie BEFORE fbevents.js loads.
 *
 * Why: we defer fbevents.js to requestIdleCallback (~1s after FCP) for speed.
 * But the Conversions API mirror fires immediately and needs `_fbp` to
 * deduplicate against the browser pixel. Without this, server-side PageView
 * has no fbp → Meta treats it as a separate event → EMQ drops.
 *
 * Format must match Meta spec exactly: `fb.<subdomainIndex>.<creationTime>.<randomNumber>`
 * https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc
 */
function ensureFbpCookie() {
  if (typeof document === "undefined") return;
  if (document.cookie.includes("_fbp=")) return; // already set by browser or prior visit
  const subdomainIndex = 1; // 1 = used directly on the registrable domain (works for www + apex)
  const creationTime = Date.now();
  const randomNumber = Math.floor(Math.random() * 10_000_000_000);
  const fbp = `fb.${subdomainIndex}.${creationTime}.${randomNumber}`;
  // 90-day cookie (Meta's standard window), top-level path, same-site Lax
  document.cookie = `_fbp=${fbp}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
}

function grantMetaConsent() {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("consent", "grant");
    }
  } catch {
    /* noop */
  }
}

function schedulePixelSelfTest(pixelId: string) {
  if (typeof window === "undefined") return;
  const w = window as any;
  const key = `pixel:${pixelId}`;
  if (w.__SF_PIXEL_SELF_TESTED__ === key) return;
  w.__SF_PIXEL_SELF_TESTED__ = key;
  setTimeout(() => {
    try {
      const fbq: any = window.fbq;
      const state = typeof fbq?.getState === "function" ? fbq.getState() : null;
      const pixels = Array.isArray(state?.pixels) ? state.pixels : [];
      const registered = pixels.some((p: any) => String(p?.id) === String(pixelId));
      if (fbq?.loaded === true && !registered) {
        console.warn("[Meta Pixel] SDK loaded but pixel is not registered", {
          pixelId,
          queueLength: Array.isArray(fbq.queue) ? fbq.queue.length : null,
          hasCallMethod: typeof fbq.callMethod === "function",
        });
      }
    } catch {
      /* diagnostic only */
    }
  }, 5000);
}

// Run once on module load — ensures shim + _fbp exist before any event fires
ensureFbqShim();
ensureFbpCookie();

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

export function useFacebookPixel(pixelId: string | null | undefined, storeId?: string | null) {
  useEffect(() => {
    if (!pixelId) return;
    if (isNonProductionHost()) return;

    // Phase 1: If index.html inline script already initialized this pixel,
    // skip — avoids duplicate init + duplicate PageView.
    const alreadyInited = (window as any).__SF_PIXEL_INITED__ === pixelId;

    // Even when inline code already initialized the pixel, keep running this
    // effect so PageView CAPI can mirror the shared event_id and the self-test
    // can verify the SDK registered the pixel after it loads.

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
    let pageViewEventId: string | undefined =
      (window as any).__SF_PV_EVENT_ID__ || undefined;
    if (!alreadyInited) {
      // Always-on Advanced Matching: pass anon visitor ID as external_id
      // so EMQ stays high even for logged-out browsers.
      const sfVid = getOrCreateSfVid();
      grantMetaConsent();
      if (sfVid) {
        window.fbq("init", pixelId, { external_id: sfVid });
      } else {
        window.fbq("init", pixelId);
      }
      // Generate shared event_id so the CAPI mirror below dedupes.
      if (!pageViewEventId) {
        pageViewEventId = generateEventId();
        (window as any).__SF_PV_EVENT_ID__ = pageViewEventId;
      }
      window.fbq("track", "PageView", {}, { eventID: pageViewEventId });
      (window as any).__SF_PIXEL_INITED__ = pixelId;
    }

    schedulePixelSelfTest(pixelId);

    // Mirror PageView to Conversions API with the SAME event_id so Meta's
    // "browser ⇄ server" diagnostic stops flagging missing coverage. Dedup
    // is guaranteed because the inline pixel and the CAPI call share eid.
    // Fire-and-forget; metaCapi internally gates on __SF_META_CAPI_ENABLED__
    // and short-circuits for stores without an access token.
    //
    // Fire immediately after this effect instead of requestIdleCallback: on
    // slow mobile cold loads, idle can be delayed long enough that PageView
    // CAPI appears missing in diagnostics even though the pixel event queued.
    if (storeId && pageViewEventId) {
      const firedKey = `pv:${storeId}:${pageViewEventId}`;
      if ((window as any).__SF_PV_CAPI_FIRED__ !== firedKey) {
        (window as any).__SF_PV_CAPI_FIRED__ = firedKey;
        setTimeout(() => {
          import("@/lib/metaCapi").then((m) => {
            m.fireMetaCAPI({
              storeId,
              eventName: "PageView",
              eventId: pageViewEventId,
            });
          }).catch(() => {});
        }, 0);
      }
    }

    // No cleanup: the fbevents.js <script> must persist for the full session.
    // Previously we removed it on unmount, which caused a fresh init + PageView
    // every time StorefrontShell re-mounted (Suspense fallback/resolve, layout
    // switch, dev StrictMode). The __SF_PIXEL_INITED__ flag handles dedup.
  }, [pixelId, storeId]);

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
