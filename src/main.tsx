import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorHandlers } from "@/lib/logError";

// Catch unhandled errors & rejections globally
initGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);

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
