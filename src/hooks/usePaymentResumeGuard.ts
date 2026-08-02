import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";

const WAIT_TTL_MS = 15 * 60 * 1000;

/**
 * Global "resume payment" recovery.
 *
 * Instagram / Facebook in-app browsers routinely destroy and recreate the
 * WebView while the shopper is inside a UPI app. When they come back, the
 * webview often reloads the ORIGINAL entry URL (the ad landing page / PDP /
 * home) instead of `/checkout`. Before this guard, CheckoutV2Page's own
 * WAIT_KEY restore never ran, so a shopper who had already paid landed on a
 * normal storefront page with zero confirmation — and, worse, a shopper mid
 * payment lost their order context and started a brand-new checkout (the
 * duplicate-pending-order pattern we kept seeing).
 *
 * This hook runs on every storefront page EXCEPT checkout: if a fresh payment
 * wait marker exists (written to BOTH session and localStorage, so it survives
 * the IABB sessionStorage wipe), it verifies the order server-side and sends
 * the shopper back to /checkout, where the existing restore effect shows the
 * confirmation screen (paid), the processing screen (pending), or the retry
 * screen (failed).
 */
export function usePaymentResumeGuard(storeId?: string | null, slug?: string | null) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!storeId) return;
    if (/\/checkout\/?$/.test(pathname)) return;

    const waitKey = `sf_wait_v2_${storeId}`;
    const payuKey = `payu_pending_${storeId}`;

    const read = (k: string) => {
      try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch { return null; }
    };
    const clear = (k: string) => {
      try { sessionStorage.removeItem(k); } catch { /* noop */ }
      try { localStorage.removeItem(k); } catch { /* noop */ }
    };

    let orderId: string | null = null;
    let ts = 0;
    try {
      const raw = read(waitKey);
      if (raw) {
        const saved = JSON.parse(raw);
        orderId = saved?.orderId || null;
        ts = Number(saved?.ts) || 0;
      } else {
        const payuRaw = read(payuKey);
        if (payuRaw) {
          const saved = JSON.parse(payuRaw);
          orderId = saved?.order_id || null;
          ts = Number(saved?.ts) || 0;
        }
      }
    } catch { /* corrupt payload — treat as absent */ }

    if (!orderId) return;
    if (!ts || Date.now() - ts > WAIT_TTL_MS) {
      clear(waitKey);
      clear(payuKey);
      return;
    }

    let cancelled = false;
    void supabase.functions
      .invoke("order-payment-status", { body: { store_id: storeId, order_id: orderId } })
      .then(({ data }) => {
        if (cancelled) return;
        const status = (data as any)?.payment_status;
        // `success` → confirmation screen. `pending` → processing screen with the
        // original wall-clock budget (CheckoutV2Page never restarts it).
        // Anything terminal-negative is cleared so we don't hijack browsing.
        if (status === "success" || status === "pending") {
          // Bounce at most ONCE per order: a shopper who consciously abandoned a
          // pending payment must be able to keep browsing without being yanked
          // back to checkout on every route change.
          const onceKey = `sf_resume_done_${orderId}`;
          if (status === "pending") {
            try {
              if (sessionStorage.getItem(onceKey)) return;
              sessionStorage.setItem(onceKey, "1");
            } catch { /* noop */ }
          }
          navigate(storefrontPath(slug || "", "checkout"), { replace: false });
        } else {
          clear(waitKey);
          clear(payuKey);
        }
      })
      .catch(() => { /* offline / cold start — retry on the next pageload */ });

    return () => { cancelled = true; };
  }, [storeId, slug, pathname, navigate]);
}
