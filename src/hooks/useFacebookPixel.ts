import { useEffect, useCallback, useState } from "react";
import { ensureFbpCookie, ensureFbcPersisted, getOrCreateSfVid } from "@/lib/metaEnrichment";
import { purgeSharedDomainCookies } from "@/lib/purgeSharedDomainCookies";


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

function grantMetaConsent() {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("consent", "grant");
    }
  } catch {
    /* noop */
  }
}

/**
 * STORE ISOLATION (P1): never use bare `fbq('track', ...)`.
 *
 * `fbq('track')` broadcasts to EVERY pixel currently registered in the page's
 * fbq instance. In a multi-tenant SPA a second merchant's pixel can end up
 * initialised in the same document (path-based `/store/:slug` navigation,
 * dashboard theme-preview iframes, a stale init from a previous route). If
 * that ever happens, one merchant's AddToCart/Purchase silently lands in
 * another merchant's ad account.
 *
 * `trackSingle` pins the event to exactly one pixel ID, so the leak class is
 * structurally impossible regardless of what else is registered.
 */
export function fbqTrackSingle(
  pixelId: string | null | undefined,
  eventName: string,
  params?: Record<string, any>,
  eventId?: string,
) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  const pid =
    pixelId || ((window as any).__SF_PIXEL_INITED__ as string | undefined) || "";
  const opts = eventId ? { eventID: eventId } : undefined;
  try {
    if (pid) {
      if (opts) window.fbq("trackSingle", pid, eventName, params, opts);
      else window.fbq("trackSingle", pid, eventName, params);
      return;
    }
    // No pixel id resolvable — drop rather than broadcast to unknown pixels.
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
      if (fbq?.loaded === true && typeof fbq.callMethod === "function" && !registered) {
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
// Purge stale apex-scoped `.shopbanao.in` cookies BEFORE ensureFbpCookie runs,
// so the fresh _fbp it mints is host-only (isolated per merchant subdomain).
purgeSharedDomainCookies();
ensureFbpCookie();
// Capture `?fbclid=` into `_fbc` at module load — BEFORE fbevents.js (deferred
// to idle) would do it. Without this, shoppers who land from an ad and convert
// within the first seconds, or whose SDK never loads (ITP / FB in-app WebView /
// slow 4G), reach checkout with no fbc → Meta cannot attribute the click.
ensureFbcPersisted();

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
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".sandbox.lovable.dev")
  );
}

export function useFacebookPixel(pixelId: string | null | undefined, storeId?: string | null) {
  useEffect(() => {
    if (!pixelId) return;
    if (isNonProductionHost()) return;
    ensureFbpCookie();
    ensureFbcPersisted();

    // Phase 1: If index.html inline script already initialized this pixel,
    // skip — avoids duplicate init + duplicate PageView.
    const alreadyInited = (window as any).__SF_PIXEL_INITED__ === pixelId;

    // Even when inline code already initialized the pixel, keep running this
    // effect so PageView CAPI can mirror the shared event_id and the self-test
    // can verify the SDK registered the pixel after it loads.

    // Load soon after init. Although the shim safely queues events, browser
    // diagnostics (including Meta Pixel Helper) cannot see a registered pixel
    // until fbevents.js has executed. A long idle/load gate therefore looked
    // like an intermittent missing pixel on fast PDP/category checks and could
    // strand short visits in browsers that aggressively freeze background tabs.
    //
    // PERF (measured 2026-07-29): plain requestIdleCallback fired the 104KB
    // `fbevents.js` download at ~1790ms on home / ~1990ms on PDP — i.e. the
    // exact millisecond of First Contentful Paint, stealing bandwidth and main
    // thread from the paint itself. Wait for the `load` event FIRST (paint is
    // done by then), then still go to idle. Purchase/Checkout paths are
    // unaffected: pixelOutbox force-loads the SDK immediately when a
    // conversion event needs it.
    // PERF (2026-07-29 follow-up): even after the `load` gate, the 104KB
    // download still landed at ~2064ms — right at FCP on slow mobile. Push it
    // behind whichever comes first:
    //   a) the shopper's FIRST interaction (pointer/touch/keyboard/scroll), or
    //   b) a short 1.2s safety timer.
    // Nothing is lost: fbq's shim queues events, pixelOutbox persists them and
    // force-loads the SDK immediately for conversion events.
    const schedule = (cb: () => void) => {
      let done = false;
      const events = ["pointerdown", "touchstart", "keydown", "scroll", "mousemove"] as const;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const run = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        events.forEach((e) => window.removeEventListener(e, run as EventListener));
        cb();
      };
      const arm = () => {
        events.forEach((e) =>
          window.addEventListener(e, run as EventListener, { once: true, passive: true })
        );
        timer = setTimeout(run, 1200);
      };
      // Arm immediately rather than waiting for window.load. In-app browsers
      // can postpone load and then freeze the tab when the shopper switches
      // apps, leaving queued events with no SDK to deliver them.
      arm();
    };



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
    //
    // Anti-ban hardening: even if `__SF_PIXEL_INITED__` somehow wasn't set by
    // the inline bootstrap (e.g. CSP race, stripped inline script on certain
    // hosts), `__SF_PV_EVENT_ID__` is a second independent signal that an
    // initial PageView has already been fired this pageload. Skip re-firing
    // it — Meta treats duplicate PVs per real visit as bot-like inflation.
    let pageViewEventId: string | undefined =
      (window as any).__SF_PV_EVENT_ID__ || undefined;
    const inlinePvAlreadyFired = !!pageViewEventId;
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
      // Only fire PageView if the inline bootstrap didn't already do so.
      if (!inlinePvAlreadyFired) {
        pageViewEventId = generateEventId();
        (window as any).__SF_PV_EVENT_ID__ = pageViewEventId;
        window.fbq("track", "PageView", {}, { eventID: pageViewEventId });
      }
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
      const clean = sanitizePixelParams(params);
      if (eventId) {
        window.fbq("track", eventName, clean, { eventID: eventId });
      } else {
        window.fbq("track", eventName, clean);
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

/**
 * Normalize Meta Pixel payload so Events Manager never logs
 * "invalid currency" / "invalid value" warnings.
 * Keep in sync with sanitizeCustomData() in supabase/functions/meta-capi/index.ts.
 */
function sanitizePixelParams(params?: Record<string, any>): Record<string, any> | undefined {
  if (!params || typeof params !== "object") return params;
  const out: Record<string, any> = { ...params };
  if ("currency" in out || "value" in out) {
    const raw = typeof out.currency === "string" ? out.currency.trim().toUpperCase() : "";
    out.currency = /^[A-Z]{3}$/.test(raw) ? raw : "INR";
  }
  if ("value" in out) {
    const n = Number(out.value);
    out.value = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  if ("num_items" in out) {
    const n = Math.floor(Number(out.num_items));
    if (!Number.isFinite(n) || n < 0) delete out.num_items;
    else out.num_items = n;
  }
  return out;
}

/** Standalone helper — call from anywhere (e.g. CartContext) */
export function fbPixelTrack(eventName: string, params?: Record<string, any>, eventId?: string) {
  if (typeof window === "undefined") return;
  if (isNonProductionHost()) return;
  if (typeof window.fbq === "function") {
    const clean = sanitizePixelParams(params);
    if (eventId) {
      window.fbq("track", eventName, clean, { eventID: eventId });
    } else {
      window.fbq("track", eventName, clean);
    }
  }
}
