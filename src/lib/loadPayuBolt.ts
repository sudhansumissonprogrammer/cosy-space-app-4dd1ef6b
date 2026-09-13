// Loads the PayU Bolt JS SDK on demand (merchant-hosted checkout).
// Single-flight: multiple callers share the same load promise.
let loadingPromise: Promise<any> | null = null;
let loadedMode: "sandbox" | "production" | null = null;

declare global {
  interface Window { bolt?: any }
}

const SDK_URL_PROD = "https://jssdk.payu.in/bolt/bolt.min.js";
const SDK_URL_TEST = "https://jssdk-uat.payu.in/bolt/bolt.min.js";

export async function loadPayuBolt(mode: "sandbox" | "production" = "production"): Promise<any> {
  if (typeof window === "undefined") throw new Error("Bolt SDK requires browser");
  // If already loaded for the same mode, reuse
  if (window.bolt && loadedMode === mode) return window.bolt;
  // If loaded for the OTHER mode, we still reuse — PayU's Bolt is environment-agnostic
  // (URL switch only). The bolt object itself just calls window.bolt.launch().
  if (window.bolt) return window.bolt;

  if (!loadingPromise) {
    const SDK_URL = mode === "sandbox" ? SDK_URL_TEST : SDK_URL_PROD;
    loadingPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        if (error) reject(error);
        else resolve();
      };
      const watchdog = window.setTimeout(() => {
        const stalled = document.querySelector(`script[data-payu-bolt]`) as HTMLScriptElement | null;
        try { stalled?.remove(); } catch {}
        finish(new Error("PayU Bolt SDK load timed out"));
      }, 10000);
      const existing = document.querySelector(`script[data-payu-bolt]`) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => finish());
        existing.addEventListener("error", () => finish(new Error("PayU Bolt SDK load failed")));
        return;
      }
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.async = true;
      s.dataset.payuBolt = mode;
      s.onload = () => finish();
      s.onerror = () => {
        try { s.remove(); } catch {}
        finish(new Error("PayU Bolt SDK load failed"));
      };
      document.head.appendChild(s);
    });
    // Clear the cached rejected promise so the next caller retries fresh.
    loadingPromise.catch(() => {
      loadingPromise = null;
      loadedMode = null;
    });
  }
  try {
    await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    loadedMode = null;
    throw err;
  }
  loadedMode = mode;
  if (!window.bolt) {
    loadingPromise = null;
    loadedMode = null;
    throw new Error("PayU Bolt SDK not available after load");
  }
  return window.bolt;
}
