import { createRoot } from "react-dom/client";
import "./index.css";
import { isCustomDomainHost, isSubdomainHost, isRootDomainHost, isPreviewHost, isLocalHost } from "@/lib/subdomain";
import { installChunkLoadRecovery } from "@/lib/chunkLoadRecovery";

if (typeof window !== "undefined" && typeof (window as any).requestIdleCallback !== "function") {
  (window as any).requestIdleCallback = (callback: (deadline: IdleDeadline) => void) => {
    const start = Date.now();
    return window.setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      } as IdleDeadline);
    }, 1);
  };
}

if (typeof window !== "undefined" && typeof (window as any).cancelIdleCallback !== "function") {
  (window as any).cancelIdleCallback = (handle: number) => window.clearTimeout(handle);
}

installChunkLoadRecovery();

// Worker strips these on production storefronts; also isolate path-based
// previews and direct origins before merchant schemas mount.
if (window.location.pathname.startsWith("/store/") || isSubdomainHost() || isCustomDomainHost()) {
  document.querySelectorAll('script[type="application/ld+json"][data-platform-seo="1"]')
    .forEach((script) => script.remove());
}

// 🔗 WhatsApp branded redirector (/r/<token>, /cart/<token>, /order/<token>)
// is now handled entirely at the Cloudflare Worker edge — it fetches wa-r
// and returns the 302 directly, with zero HTML/JS. This saves the 2-4s
// previously spent downloading + parsing LandingApp just to run
// window.location.replace(). See docs/cloudflare-worker-current.js
// (WhatsApp branded redirector — EDGE FAST PATH).
//
// The JS fallback below only fires if a user somehow lands on these paths
// via the SPA (e.g. Worker bypass, local dev, or preview host) — real
// production traffic never reaches this code.
if (typeof window !== "undefined") {
  const p = window.location.pathname;
  let redirectToken = "";
  if (p.startsWith("/r/")) {
    redirectToken = p.slice(3).split("/")[0].split("?")[0];
  } else if (p.startsWith("/cart/")) {
    const t = p.slice(6).split("/")[0].split("?")[0];
    if (t) redirectToken = "c-" + t;
  } else if (p.startsWith("/order/")) {
    const t = p.slice(7).split("/")[0].split("?")[0];
    if (t) redirectToken = "o-" + t;
  }
  if (redirectToken) {
    const api = "https://dqepeywgftbpxeeqfuwt.supabase.co";
    const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk";
    const fallback = () => window.location.replace(`${api}/functions/v1/wa-r/${encodeURIComponent(redirectToken)}`);
    // Signed marketing links (`p-<id>~<phone>`) can only be resolved by the
    // edge function, which also mints the auto-login session. The RPC returns
    // {ok:false} for them, so go straight to wa-r and skip a dead round-trip.
    if (redirectToken.includes("~")) {
      try { window.stop(); } catch { /* noop */ }
      fallback();
      throw new Error("redirecting");
    }
    const timer = window.setTimeout(fallback, 900);
    try { window.stop(); } catch { /* noop */ }
    fetch(`${api}/rest/v1/rpc/get_wa_redirect`, {

      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ _token: redirectToken }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && d?.target) {
          window.clearTimeout(timer);
          window.location.replace(d.target);
        } else {
          fallback();
        }
      })
      .catch(fallback);
    throw new Error("redirecting"); // halt module eval
  }
}




// Capture ?ref=SBP… anywhere in the site (landing, signup, storefront subdomain).
// Runs before App mounts so the cookie is set even on the landing fast-path.
// PERF: defer to idle so the chunk download never competes with LCP. The
// referral cookie only matters before the user submits a signup form, not in
// the first second of paint — idle scheduling drops ~1KB + 1 RTT from cold.
if (typeof window !== "undefined" && window.location.search.includes("ref=")) {
  const loadRef = () => {
    import("@/lib/referralTracking")
      .then(({ captureReferralFromURL }) => captureReferralFromURL())
      .catch(() => {});
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(loadRef, { timeout: 4000 });
  } else {
    setTimeout(loadRef, 1500);
  }
}

/**
 * 🚀 LANDING-ONLY FAST PATH
 * If the initial URL is the marketing landing page (`/` or `/theme`) on the
 * root marketing host, mount a slimmed-down `<LandingApp />` instead of the
 * full `<App />`. This keeps the storefront (14 themes), dashboard, auth,
 * Supabase client, and react-query OFF the landing critical path entirely.
 *
 * The full App is still prefetched at idle so subsequent hard-navigation to
 * /login or /dashboard feels instant.
 */
function shouldUseLandingFastPath(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  const isLandingPath = path === "/" || path === "/theme" || path === "/guides" || path.startsWith("/guides/");
  if (!isLandingPath) return false;
  // Storefront subdomains and custom domains must always use the full App
  // (they render storefront at `/`, not the marketing landing).
  const host = window.location.hostname;
  if (isSubdomainHost(host) || isCustomDomainHost(host)) return false;
  // Worker-injected storefront data also means storefront flow.
  if ((window as any).__STORE_SLUG__ || (window as any).__STOREFRONT_DATA__) return false;
  return true;
}

// Defer non-critical font CSS imports.
//
// CRITICAL: These fonts are ONLY used by the marketing landing
// (Plus Jakarta Sans) and the dashboard (Montserrat Alternates).
// Storefronts (subdomains + custom domains) load their OWN theme fonts
// via the Cloudflare Worker (data-sf-font), so importing these here on
// storefront hosts ships ~180KB of render-blocking CSS for nothing —
// real measurement showed two 3KB CSS files blocking paint for 2.7–2.9s
// on cold mobile loads (CSS triggers font-face fetches as render-blocking).
{
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isStorefrontHost =
    host && (isSubdomainHost(host) || isCustomDomainHost(host));
  const isLanding = path === "/" || path === "/theme" || path === "/guides" || path.startsWith("/guides/");

  if (!isStorefrontHost) {
    const loadFonts = () => {
      // Plus Jakarta — used by landing + dashboard
      import('@fontsource/plus-jakarta-sans/400.css');
      import('@fontsource/plus-jakarta-sans/600.css');
      // Montserrat Alternates is dashboard-only. Skip on landing to avoid
      // ~50KB of extra CSS + 2 font fetches that were landing on the cold
      // critical path even though landing never uses this font.
      if (!isLanding) {
        import('@fontsource/montserrat-alternates/400.css');
        import('@fontsource/montserrat-alternates/600.css');
      }
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(loadFonts, { timeout: 2000 });
    } else {
      setTimeout(loadFonts, 500);
    }
  }
}

// Defer global error handlers to idle time — not needed during first paint
if ("requestIdleCallback" in window) {
  (window as any).requestIdleCallback(() => {
    import("@/lib/logError").then(({ initGlobalErrorHandlers }) => initGlobalErrorHandlers());
  }, { timeout: 3000 });
} else {
  setTimeout(() => {
    import("@/lib/logError").then(({ initGlobalErrorHandlers }) => initGlobalErrorHandlers());
  }, 2000);
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Application root is missing");

/**
 * Two-tier entry point:
 *
 * 1. Landing fast-path  → import("./LandingApp")  (Rollup statically traces this
 *    so LandingApp + Index + landing components are bundled and modulepreload-hinted)
 *
 * 2. Everything else    → import("./App") via a dynamically-built string so Rollup
 *    CANNOT see this as a graph edge. App + radix + supabase + react-query are
 *    NOT added to the landing critical-path modulepreload list.
 *
 * Without the dynamic-string trick, Rollup walks both branches and emits
 * <link rel="modulepreload"> for ~500KB of code that landing never executes.
 */
// Signals the inline boot guard in index.html that the app actually started,
// so it never triggers a recovery reload on a healthy page.
function markBooted() {
  (window as any).__APP_BOOTED__ = true;
  try { (window as any).__sbBootOk?.(); } catch {}
}

if (shouldUseLandingFastPath()) {
  import("./LandingApp").then(({ default: LandingApp }) => {
    createRoot(rootElement).render(<LandingApp />);
    markBooted();
  });
} else {
  // PERF (measured 2026-07-29): on storefront hosts the `storefront-shell`
  // chunk (+ supabase / router-query / radix-slot / icons) was only discovered
  // AFTER App.js finished parsing — a full extra RTT wave starting at ~584ms
  // (home) / ~803ms (PDP) on cold mobile. Kick that wave off in PARALLEL with
  // App.js instead of after it.
  //
  // CartContext lives in the `storefront-shell` manualChunk (see vite.config)
  // and has no import-time side effects, so touching it only warms the network
  // + module cache. This is a DYNAMIC import from the entry, so Rollup adds no
  // static graph edge — the landing entry stays lean (see the `subdomain` note
  // in vite.config manualChunks).
  const host = window.location.hostname;
  if (
    isSubdomainHost(host) ||
    isCustomDomainHost(host) ||
    (window as any).__STORE_SLUG__ ||
    (window as any).__STOREFRONT_DATA__
  ) {
    import("@/contexts/CartContext").catch(() => {});
  }

  import("./App").then(({ default: App }) => {
    createRoot(rootElement).render(<App />);
    markBooted();
  });
}



// storefront:mounted is no longer used for skeleton removal.
// Worker skeleton is removed only by storefront:content-ready or 12s fallback.

/**
 * Any live/public host must NOT use a service worker, otherwise browsers can
 * keep serving stale HTML/JS after publish. Only preview/local are safe.
 */
function isPublishedHost(): boolean {
  const hostname = window.location.hostname;
  return !isPreviewHost(hostname) && !isLocalHost(hostname);
}

function isSafeSwHost(): boolean {
  const hostname = window.location.hostname;
  return isPreviewHost(hostname) || isLocalHost(hostname);
}

/**
 * Service Worker strategy:
 * - All live/public hosts: NEVER register SW.
 *   Instead, aggressively clean up any legacy SW + caches to prevent
 *   stale HTML/JS from being served after publish.
 * - Only preview/local hosts register SW.
 */
if ("serviceWorker" in navigator) {
  if (isPublishedHost()) {
    // ── LIVE HOSTS: Always clean stale SW/cache silently ──
    // Previous one-shot cleanup could be skipped forever if localStorage was
    // set before the browser fully removed an older Workbox SW. Run a cheap
    // idle cleanup on every live visit so product/category API responses can
    // never stay hidden behind a legacy device cache.
    const cleanupLiveServiceWorkers = () => {
      Promise.all([
        navigator.serviceWorker.getRegistrations(),
        "caches" in window ? caches.keys().catch(() => [] as string[]) : Promise.resolve([] as string[]),
      ]).then(([registrations, keys]) => {
        const staleRegistrations = registrations.filter((r) => !r.active?.scriptURL.includes("/sw-push.js"));
        const staleCacheKeys = keys.filter((k) => /workbox|precache|html-pages|static-assets|edge-api|images|google-fonts/i.test(k));
        if (!staleRegistrations.length && !staleCacheKeys.length) return;
        Promise.all([
          ...staleRegistrations.map((r) => r.unregister()),
          ...staleCacheKeys.map((k) => caches.delete(k)),
        ]).catch(() => {});
      }).catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(cleanupLiveServiceWorkers, { timeout: 2000 });
    } else {
      setTimeout(cleanupLiveServiceWorkers, 1000);
    }
    // Do NOT register caching SW on live hosts. Push registers /sw-push.js on demand.
  } else if (isSafeSwHost()) {
    // ── PREVIEW/LOCAL ONLY: Normal SW registration (idle) ──
    const registerSW = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(registerSW, { timeout: 5000 });
    } else {
      setTimeout(registerSW, 3000);
    }
  }
  // else: unknown host — do nothing
}
