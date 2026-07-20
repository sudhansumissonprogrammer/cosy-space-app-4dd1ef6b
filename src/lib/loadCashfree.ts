// Loads Cashfree Drop-in checkout SDK on demand.
let loadingPromise: Promise<any> | null = null;

declare global {
  interface Window { Cashfree?: any }
}

const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

export async function loadCashfree(mode: "sandbox" | "production" = "production"): Promise<any> {
  if (typeof window === "undefined") throw new Error("Cashfree SDK requires browser");
  if (window.Cashfree) return window.Cashfree({ mode });

  if (!loadingPromise) {
    loadingPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SDK_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", () => reject(new Error("Cashfree SDK load failed")));
        return;
      }
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => {
        // Remove the failed <script> so a subsequent retry re-inserts it.
        try { s.remove(); } catch {}
        reject(new Error("Cashfree SDK load failed"));
      };
      document.head.appendChild(s);
    });
    // CRITICAL: on failure, clear the cached promise so the NEXT caller
    // gets a fresh load attempt (previously a single flaky load stuck the
    // user until full page reload).
    loadingPromise.catch(() => {
      loadingPromise = null;
    });
  }
  try {
    await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
  if (!window.Cashfree) {
    loadingPromise = null;
    throw new Error("Cashfree SDK not available");
  }
  return window.Cashfree({ mode });
}
