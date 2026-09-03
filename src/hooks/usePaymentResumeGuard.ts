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
    // Legacy (old) checkout persists its Cashfree hand-off here. Without it a
    // shopper on the OLD checkout who pays via Cashfree and gets dropped on a
    // random storefront page is never bounced back — the exact gap the V2 keys
    // already close.
    const cfKey = `cf_pending_${storeId}`;

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
        if (!orderId) {
          const cfRaw = read(cfKey);
          if (cfRaw) {
            const saved = JSON.parse(cfRaw);
            orderId = saved?.order?.id || null;
            ts = Number(saved?.ts) || 0;
          }
        }
      }
    } catch { /* corrupt payload — treat as absent */ }

    if (!orderId) return;
    if (!ts || Date.now() - ts > WAIT_TTL_MS) {
      clear(waitKey);
      clear(payuKey);
      clear(cfKey);
      return;
    }


    let cancelled = false;
    void supabase.functions
      .invoke("order-payment-status", { body: { store_id: storeId, order_id: orderId } })
      .then(({ data }) => {
        if (cancelled) return;
        const status = (data as any)?.payment_status;
        if (status !== "success" && status !== "pending" && status !== "failed") {
          clear(waitKey);
          clear(payuKey);
          clear(cfKey);
          return;

        }
        // Bounce at most ONCE per order PER STATUS. A single per-order flag was
        // the "paid but stuck on the store" bug: the shopper returns from the
        // UPI app while the order is still `pending`, gets bounced once (flag
        // set), taps back into a product page, and by the time the gateway
        // reconciles to `success` the guard refuses to bounce again — so the
        // confirmation screen is never shown and they re-launch payment on an
        // already-paid order. Keying the flag by status lets each real state
        // change through exactly once while still preventing Back-button loops.
        const onceKey = `sf_resume_done_${orderId}_${status}`;
        try {
          if (sessionStorage.getItem(onceKey) || localStorage.getItem(onceKey)) return;
          sessionStorage.setItem(onceKey, "1");
          localStorage.setItem(onceKey, "1");
        } catch { /* noop */ }
        // CheckoutV2Page restores its processing/confirmation screen from the
        // wait marker. If only the legacy payu/cashfree key survived, write the
        // v2 marker too so the restore effect can pick the order up instead of
        // rendering a fresh, payable checkout for an order that is already paid.
        try {
          if (!read(waitKey)) {
            const payload = JSON.stringify({ orderId, orderNumber: null, app: "any", label: "UPI", ts });
            sessionStorage.setItem(waitKey, payload);
            localStorage.setItem(waitKey, payload);
          }
        } catch { /* noop */ }
        // `replace` so the page we came from stays the Back target; pushing a
        // checkout entry on top of it made Back re-trigger this guard forever.
        navigate(storefrontPath(slug || "", "checkout"), { replace: true });

      })
      .catch(() => { /* offline / cold start — retry on the next pageload */ });


    return () => { cancelled = true; };
  }, [storeId, slug, pathname, navigate]);
}
