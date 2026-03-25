import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorHandlers } from "@/lib/logError";

// Catch unhandled errors & rejections globally
initGlobalErrorHandlers();

/**
 * Wait for the storefront prefetch (started in index.html) to complete
 * BEFORE mounting React. This ensures data is available synchronously,
 * eliminating the double-skeleton flash (HTML skeleton → React skeleton).
 * The HTML skeleton stays visible during this wait, giving a single smooth transition.
 * Timeout after 4s to avoid blocking forever on slow networks.
 */
async function boot() {
  const prefetch = (window as any).__STOREFRONT_PREFETCH__;
  if (prefetch) {
    try {
      const result = await Promise.race([
        prefetch,
        new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (result) {
        (window as any).__STOREFRONT_DATA__ = result;
      }
    } catch {}
    delete (window as any).__STOREFRONT_PREFETCH__;
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

boot();

/**
 * Service Worker registration with stale-SW cleanup.
 *
 * Problem: Old Workbox SWs precached the bare index.html (without __STORE_SLUG__).
 * When users visit a storefront, the old SW intercepts navigation and serves this
 * empty shell instead of the Cloudflare Worker-injected HTML → login page or skeleton.
 *
 * Fix: If we detect we're on a storefront route (custom domain / subdomain) and
 * __STORE_SLUG__ is missing while an SW is active, unregister it and reload once.
 * A sessionStorage flag prevents infinite reload loops.
 */
if ('serviceWorker' in navigator) {
  const hostname = window.location.hostname;
  const isCustomDomainOrSubdomain =
    !hostname.endsWith('.lovable.app') &&
    hostname !== 'localhost' &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  const hasStoreContext = !!(window as any).__STORE_SLUG__;
  const swCleanupDone = sessionStorage.getItem('sw_cleanup_v1');

  // If on a storefront domain without store context and an old SW may be serving stale HTML
  if (isCustomDomainOrSubdomain && !hasStoreContext && !swCleanupDone) {
    sessionStorage.setItem('sw_cleanup_v1', '1');
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length > 0) {
        Promise.all(registrations.map((r) => r.unregister())).then(() => {
          // Clear all caches left by the old SW
          caches.keys().then((keys) => {
            Promise.all(keys.map((k) => caches.delete(k))).then(() => {
              window.location.reload();
            });
          });
        });
      }
    });
  } else {
    // Normal SW registration — deferred until idle
    const registerSW = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(registerSW, { timeout: 5000 });
    } else {
      setTimeout(registerSW, 3000);
    }
  }
}
