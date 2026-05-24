// Client-side pageview beacon — strict accuracy edition.
//
// Why this exists (v8.44.1):
//   The Cloudflare Worker writes pageviews on cold/MISS requests, but
//   Cloudflare's CDN cache serves ~95% of visits without invoking the
//   Worker. We need a browser-side beacon to capture cache hits.
//
// Strict accuracy guarantees (v8.46.0):
//   - visitor_id (2y persistent) → unique humans, never inflated
//   - session_id (30-min sliding) → real sessions, not raw rows
//   - is_bot flag → bots that DO run JS get marked + excluded in dashboard
//   - per-pathname dedup → SPA effects don't double-count
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrCreateSessionId,
  getVisitorId,
  isLikelyBot,
} from "@/lib/visitorSession";

export function usePageviewBeacon(storeId: string | undefined | null) {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
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

    const vid = getVisitorId();
    const sid = getOrCreateSessionId();
    const bot = isLikelyBot();

    // v8.46.1 Option D — hourly dedup across reloads/back-forward.
    // Key = visitor+path+hour. sessionStorage clears on tab close.
    // Cuts pageview writes ~40-60%. Visitors/Sessions stay accurate
    // (those are unique-counted from visitor_id/session_id, not row count).
    try {
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const dedupKey = `pv:${vid || sid}:${pathname}:${hourBucket}`;
      if (sessionStorage.getItem(dedupKey)) return;
      sessionStorage.setItem(dedupKey, "1");
    } catch {
      // sessionStorage blocked — fall through and insert
    }

    try {
      supabase
        .from("page_views")
        .insert({
          store_id: storeId,
          path: pathname.slice(0, 500),
          visitor_id: vid || null,
          session_id: sid,
          is_bot: bot,
        })
        .then(() => {}, () => {});
    } catch {}
  }, [storeId, pathname]);
}
