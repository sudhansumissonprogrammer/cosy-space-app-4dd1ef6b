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

// Defer SW registration until page is idle to avoid render-blocking
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(registerSW, { timeout: 5000 });
  } else {
    setTimeout(registerSW, 3000);
  }
}
