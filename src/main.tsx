import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorHandlers } from "@/lib/logError";
import { isCustomDomainHost, isSubdomainHost, isRootDomainHost, isPreviewHost, isLocalHost } from "@/lib/subdomain";

// Catch unhandled errors & rejections globally
initGlobalErrorHandlers();

/**
 * Mount React immediately — no blocking await.
 * If Worker injected __STOREFRONT_DATA__, useStorefront picks it up as initialData.
 * If a prefetch promise is in flight, let it resolve in the background;
 * useStorefront will use it when ready (or fetch via RPC as fallback).
 */
createRoot(document.getElementById("root")!).render(<App />);

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
