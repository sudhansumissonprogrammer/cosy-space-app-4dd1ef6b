import { createRoot } from "react-dom/client";
import App from "./App.tsx";
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

// Defer non-critical font CSS imports — they block initial render for ALL routes
// but are only needed by dashboard (Montserrat Alternates) and landing (Plus Jakarta Sans).
// Loading them after React mount saves ~200ms on first paint.
if ("requestIdleCallback" in window) {
  (window as any).requestIdleCallback(() => {
    import('@fontsource/plus-jakarta-sans/400.css');
    import('@fontsource/plus-jakarta-sans/600.css');
    import('@fontsource/montserrat-alternates/400.css');
    import('@fontsource/montserrat-alternates/600.css');
  }, { timeout: 2000 });
} else {
  setTimeout(() => {
    import('@fontsource/plus-jakarta-sans/400.css');
    import('@fontsource/plus-jakarta-sans/600.css');
    import('@fontsource/montserrat-alternates/400.css');
    import('@fontsource/montserrat-alternates/600.css');
  }, 500);
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

createRoot(rootElement).render(<App />);

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
      Promise.all([
        navigator.serviceWorker.getRegistrations(),
        caches.keys().catch(() => [] as string[]),
      ]).then(([registrations, keys]) => {
        const hadWorker = registrations.length > 0;
        const hadCaches = keys.length > 0;

        Promise.all(registrations.map((r) => r.unregister()))
          .then(() => Promise.all(keys.map((k) => caches.delete(k))))
          .then(() => {
            if (hadWorker || hadCaches) {
              // Use replace() so reload doesn't pollute history
              window.location.replace(window.location.href);
            }
          });
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
