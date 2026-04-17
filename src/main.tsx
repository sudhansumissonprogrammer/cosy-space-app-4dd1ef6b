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
 * Determine if current host is a storefront (custom domain or subdomain).
 * SW should NEVER be registered on storefront hosts to prevent stale HTML caching.
 */
function isStorefrontHost(): boolean {
  const hostname = window.location.hostname;
  return isCustomDomainHost(hostname) || isSubdomainHost(hostname);
}

/**
 * Determine if current host is the primary app/dashboard domain
 * where SW is safe to register.
 */
function isDashboardHost(): boolean {
  const hostname = window.location.hostname;
  return isRootDomainHost(hostname) || isPreviewHost(hostname) || isLocalHost(hostname);
}

/**
 * Service Worker strategy:
 * - Storefront hosts (custom domains + subdomains): NEVER register SW.
 *   Instead, aggressively clean up any legacy SW + caches to prevent
 *   stale HTML/JS from being served.
 * - Dashboard/app hosts: Register SW normally for offline/caching benefits.
 */
if ("serviceWorker" in navigator) {
  if (isStorefrontHost()) {
    // ── STOREFRONT: Aggressive SW cleanup ──
    // Legacy SWs on storefront hosts cause stale HTML, wrong pages,
    // and HTML↔JS version skew. Clean them up once per session.
    const cleanupDone = sessionStorage.getItem("sw_cleanup_v2");
    if (!cleanupDone) {
      sessionStorage.setItem("sw_cleanup_v2", "1");
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          Promise.all(registrations.map((r) => r.unregister())).then(() => {
            caches.keys().then((keys) => {
              Promise.all(keys.map((k) => caches.delete(k))).then(() => {
                window.location.reload();
              });
            });
          });
        }
      });
    }
    // Do NOT register SW on storefront hosts — ever.
  } else if (isDashboardHost()) {
    // ── DASHBOARD: Normal SW registration (idle) ──
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
