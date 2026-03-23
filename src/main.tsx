import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorHandlers } from "@/lib/logError";

// Catch unhandled errors & rejections globally
initGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);

// Defer Service Worker registration until after the page is interactive
// This prevents registerSW.js from blocking the critical rendering path (~160ms saving)
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {});
  }
}

if ("requestIdleCallback" in window) {
  (window as any).requestIdleCallback(registerSW);
} else {
  setTimeout(registerSW, 3000);
}
