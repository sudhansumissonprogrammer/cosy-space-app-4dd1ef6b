import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ── Post-interactive setup: deferred to avoid blocking first paint ──

function postInteractiveSetup() {
  // 1. Initialize global error handlers (deferred — not needed for first paint)
  import("@/lib/logError").then(({ initGlobalErrorHandlers }) => {
    initGlobalErrorHandlers();
  });

  // 2. Register Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {});
  }

  // 3. Set up hover-based link prefetching + idle route prefetch
  import("@/lib/prefetch").then(({ setupHoverPrefetch, prefetchCriticalRoutes }) => {
    setupHoverPrefetch();
    prefetchCriticalRoutes();
  });
}

if ("requestIdleCallback" in window) {
  (window as any).requestIdleCallback(postInteractiveSetup, { timeout: 4000 });
} else {
  setTimeout(postInteractiveSetup, 3000);
}
