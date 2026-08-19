import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseStorefront } from "@/integrations/supabase/storefrontClient";

/**
 * Consumes WhatsApp deep-link auth hints (issued by wa-r) and warms the
 * checkout chunk so a follow-up Buy Now hits an instant, hydrated screen.
 *
 * Two consumption modes, in priority order:
 *
 *  1. **Fragment fast-path** — `#als=<access>|<refresh>|<phone>`
 *     Session pre-minted server-side by wa-r during the redirect. Zero
 *     round-trip on the client: we call `setSession()` and we're done. This
 *     is what makes WA → PDP → Checkout land already-logged-in in one
 *     network hop instead of three.
 *
 *  2. **Query fallback** — `?al=<signed-token>`
 *     Signed HMAC token; consumed by the wa-autologin edge function.
 *     Used when the pre-mint budget expired (slow auth API), when older
 *     wa-r versions issued links, or when the fragment was stripped by an
 *     intermediary.
 *
 * Both markers are scrubbed from the visible URL immediately so they don't
 * leak into referrers, bookmarks, or analytics. Runs once per page load.
 * Idempotent — a stale marker on a page where a session is already present
 * is a cheap no-op.
 */
export default function StorefrontAutoLogin({ storeId }: { storeId?: string }) {
  useEffect(() => {
    let cancelled = false;

    // Parse fragment markers manually — window.location.hash is "#als=..."
    // shape; may co-exist with normal `#` anchors (uncommon on storefronts).
    function readFragmentSession(): { access: string; refresh: string; phone: string } | null {
      try {
        const raw = window.location.hash;
        if (!raw || raw.length < 2) return null;
        // Fragment can contain multiple `&`-separated k=v pairs (see wa-r).
        const body = raw.slice(1);
        const alsPart = body.split("&").find((s) => s.startsWith("als="));
        if (!alsPart) return null;
        const val = alsPart.slice(4);
        const [aEnc, rEnc, phone] = val.split("|");
        if (!aEnc || !rEnc) return null;
        return {
          access: decodeURIComponent(aEnc),
          refresh: decodeURIComponent(rEnc),
          phone: phone || "",
        };
      } catch {
        return null;
      }
    }

    function stripMarkers(): { hadMarker: boolean } {
      try {
        const url = new URL(window.location.href);
        const hadQuery = url.searchParams.has("al") || url.searchParams.has("wa");
        url.searchParams.delete("al");
        url.searchParams.delete("wa");


        // Rewrite fragment — strip only the `als=` pair, keep any other anchor.
        let hadFrag = false;
        let newHash = "";
        if (url.hash && url.hash.length > 1) {
          const kept = url.hash
            .slice(1)
            .split("&")
            .filter((s) => {
              if (s.startsWith("als=")) { hadFrag = true; return false; }
              return true;
            });
          newHash = kept.length ? `#${kept.join("&")}` : "";
        }

        if (hadQuery || hadFrag) {
          const q = url.searchParams.toString();
          window.history.replaceState(
            {},
            "",
            url.pathname + (q ? `?${q}` : "") + newHash,
          );
        }
        return { hadMarker: hadQuery || hadFrag };
      } catch {
        return { hadMarker: false };
      }
    }

    // Warm the checkout chunk after a successful WA autologin — the shopper is
    // ~90% likely to hit Buy Now next, and the chunk is otherwise fetched only
    // on route navigation. Non-blocking; failures ignored.
    function prefetchCheckoutChunk() {
      try {
        import("@/pages/CheckoutV2Page").catch(() => {});
      } catch { /* noop */ }
    }

    (async () => {
      try {
        const url = new URL(window.location.href);
        const queryToken = url.searchParams.get("al");
        const fragSession = readFragmentSession();
        // `wa=1` is stamped on EVERY wa-r redirect, even when the auto-login
        // mint failed. It is the source of truth for "arrived from a WhatsApp
        // marketing message" and unlocks the WA-exclusive coupon on the PDP
        // and at checkout.
        const waMarker = url.searchParams.get("wa") === "1";
        if (waMarker) {
          try { sessionStorage.setItem("sf_wa_source", "1"); } catch { /* noop */ }
          try { localStorage.setItem("sf_wa_source", "1"); } catch { /* noop */ }
          try { window.dispatchEvent(new Event("sf-wa-source")); } catch { /* noop */ }
        }
        if (!queryToken && !fragSession) {
          if (waMarker) stripMarkers();
          return;
        }

        // Strip markers ASAP (before any await) so a refresh doesn't replay.
        stripMarkers();

        // Mark WA-source in session storage — used by store-owner-gated
        // auto-apply coupons downstream (see StorefrontAutoLogin history).
        try { sessionStorage.setItem("sf_wa_source", "1"); } catch { /* noop */ }
        try { localStorage.setItem("sf_wa_source", "1"); } catch { /* noop */ }
        try { window.dispatchEvent(new Event("sf-wa-source")); } catch { /* noop */ }


        // If a storefront session is already present, skip everything — the
        // shopper is already logged-in for THIS storefront.
        try {
          const { data: { session } } = await supabaseStorefront.auth.getSession();
          if (session?.user) {
            prefetchCheckoutChunk();
            return;
          }
        } catch { /* fall through */ }

        // ────────────────────────────────────────────────────────────────
        // FAST PATH — pre-minted session in URL fragment
        // ────────────────────────────────────────────────────────────────
        if (fragSession) {
          try {
            await supabaseStorefront.auth.setSession({
              access_token: fragSession.access,
              refresh_token: fragSession.refresh,
            });
            if (fragSession.phone) {
              try { localStorage.setItem("checkout_phone", fragSession.phone); } catch { /* noop */ }
            }
            if (!cancelled) prefetchCheckoutChunk();
            return;
          } catch { /* fall through to signed-token fallback */ }
        }

        // ────────────────────────────────────────────────────────────────
        // FALLBACK — signed token consumed by wa-autologin edge function
        // ────────────────────────────────────────────────────────────────
        if (!queryToken) return;
        const { data, error } = await supabase.functions.invoke("wa-autologin", {
          body: { token: queryToken, store_id: storeId },
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
          if (result.phone) {
            try { localStorage.setItem("checkout_phone", result.phone); } catch { /* noop */ }
          }
          if (!cancelled) prefetchCheckoutChunk();
        }
      } catch { /* swallow — page must still render */ }
    })();

    return () => { cancelled = true; };
  }, [storeId]);

  return null;
}
