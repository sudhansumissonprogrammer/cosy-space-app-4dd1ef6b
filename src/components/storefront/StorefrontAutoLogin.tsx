import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseStorefront } from "@/integrations/supabase/storefrontClient";

/**
 * Consumes `?al=<signed-token>` (issued by wa-r for WhatsApp deep links) and
 * mints a storefront session so the shopper lands already logged-in.
 *
 * Effect: order-confirmation links open the account/order page with the
 * customer signed in; marketing / cart-recovery links land on the product page
 * with the customer signed in — so a subsequent Buy Now skips the phone gate
 * AND the address form (auto-filled from `storefront_customers` + saved
 * addresses). The URL is scrubbed of the token immediately.
 *
 * Runs once per page load. Idempotent — a stale param on a page where the
 * session is already present is a cheap no-op.
 */
export default function StorefrontAutoLogin({ storeId }: { storeId?: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const token = url.searchParams.get("al");
        if (!token) return;

        // Strip the token from the visible URL immediately so it doesn't
        // leak into referrers / bookmarks / analytics.
        url.searchParams.delete("al");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash);

        // Mark this session as originating from a WhatsApp deep link so
        // downstream flows (e.g. store-owner-gated auto-apply coupons) can
        // reward only shoppers who arrived via the marketing/recovery link.
        try { sessionStorage.setItem("sf_wa_source", "1"); } catch { /* noop */ }

        // Skip the round-trip when a session is already present for THIS
        // storefront (avoids double-mint on refresh with stale query).
        try {
          const { data: { session } } = await supabaseStorefront.auth.getSession();
          if (session?.user) return;
        } catch { /* fall through — attempt autologin */ }

        const { data, error } = await supabase.functions.invoke("wa-autologin", {
          body: { token, store_id: storeId },
        });
        if (cancelled || error || !data) return;
        const result = data as {
          session?: { access_token?: string; refresh_token?: string };
          phone?: string | null;
        };
        if (result?.session?.access_token && result?.session?.refresh_token) {
          await supabaseStorefront.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
          // Seed the phone hint so Buy Now → Checkout skips the phone gate on
          // the very first render (before the auth listener has hydrated).
          if (result.phone) {
            try { localStorage.setItem("checkout_phone", result.phone); } catch { /* noop */ }
          }
        }
      } catch { /* swallow — page must still render */ }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  return null;
}
