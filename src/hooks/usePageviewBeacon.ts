// Client-side pageview beacon.
//
// Why this exists (v8.44.1):
//   The Cloudflare Worker writes pageviews on cold/MISS requests, but
//   Cloudflare's CDN cache layer serves cached HTML to ~95% of visits
//   WITHOUT invoking the Worker at all (no X-Worker-Version header on
//   responses confirms this). Result: page_views was empty → Sessions
//   and Conversion in StoreAnalytics stayed at zero.
//
// Fix: every storefront route change fires a tiny insert from the
// browser, exactly like GA4 / Plausible / Meta Pixel do. Bypasses cache
// entirely. Dedupes per pathname inside a single navigation so SPA
// effects don't double-count.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateSfVid } from "@/lib/metaEnrichment";

export function usePageviewBeacon(storeId: string | undefined | null) {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    // Skip private paths — checkout/account aren't useful "visit" signals
    // and they're already excluded from the Worker's count.
    if (
      pathname.startsWith("/checkout") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/")
    ) {
      return;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    const vid = (() => {
      try { return getOrCreateSfVid(); } catch { return null; }
    })();

    // Fire-and-forget. Failures are silent — analytics must never break
    // navigation. We don't await; the supabase-js client batches POSTs
    // and the response is irrelevant to UI.
    try {
      supabase
        .from("page_views")
        .insert({
          store_id: storeId,
          path: pathname.slice(0, 500),
          visitor_id: vid || null,
        })
        .then(() => {}, () => {});
    } catch {}
  }, [storeId, pathname]);
}
