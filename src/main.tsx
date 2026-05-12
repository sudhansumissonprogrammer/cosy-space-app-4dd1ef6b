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

// Capture ?ref=SBP… anywhere in the site (landing, signup, storefront subdomain).
// Runs before App mounts so the cookie is set even on the landing fast-path.
if (typeof window !== "undefined" && window.location.search.includes("ref=")) {
  import("@/lib/referralTracking")
    .then(({ captureReferralFromURL }) => captureReferralFromURL())
    .catch(() => {});
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
  if (path !== "/" && path !== "/theme") return false;
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
  const isStorefrontHost =
    host && (isSubdomainHost(host) || isCustomDomainHost(host));

  if (!isStorefrontHost) {
    const loadFonts = () => {
      import('@fontsource/plus-jakarta-sans/400.css');
      import('@fontsource/plus-jakarta-sans/600.css');
      import('@fontsource/montserrat-alternates/400.css');
      import('@fontsource/montserrat-alternates/600.css');
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

const rootElement = document.getElementById("root")!;

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
if (shouldUseLandingFastPath()) {
  import("./LandingApp").then(({ default: LandingApp }) => {
    createRoot(rootElement).render(<LandingApp />);
  });
} else {
  import("./App").then(({ default: App }) => {
    createRoot(rootElement).render(<App />);
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
    // ── LIVE HOSTS: Aggressive SW cleanup ──
    // Legacy SWs on published hosts cause stale HTML. Clean up ONCE per device
    // (localStorage, not sessionStorage) — otherwise every new tab triggers a
    // full reload + double skeleton on first visit.
    const CLEANUP_KEY = "sw_cleanup_v4";
    const cleanupDone = (() => {
      try { return localStorage.getItem(CLEANUP_KEY); } catch { return "1"; }
    })();
    if (!cleanupDone) {
      try { localStorage.setItem(CLEANUP_KEY, "1"); } catch {}
      // v8.16: NEVER reload after cleanup. In WebViews with volatile
      // localStorage (Instagram in-app browser, some Chrome sandboxes,
      // blocked-storage modes) the CLEANUP_KEY doesn't persist, so every
      // page load re-ran cleanup → window.location.replace → reload loop
      // every ~10-15s. Just unregister silently; the next user-initiated
      // navigation will pick up fresh assets without any forced reload.
      Promise.all([
        navigator.serviceWorker.getRegistrations(),
        caches.keys().catch(() => [] as string[]),
      ]).then(([registrations, keys]) => {
        Promise.all(registrations.map((r) => r.unregister()))
          .then(() => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      });
    }
    // Do NOT register SW on live hosts — ever.
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
