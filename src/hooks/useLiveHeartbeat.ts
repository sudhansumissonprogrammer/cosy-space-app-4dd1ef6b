// Live-visitor heartbeat.
//
// Why: "Live visitors" used to count every session that fired a pageview in the
// last 5 minutes. With ad traffic that over-counts badly — a shopper who bounced
// after 3 seconds still showed as "browsing now" for 5 more minutes.
//
// This pings `touch_live_session` every 20s while the tab is actually VISIBLE.
// A shopper who leaves stops pinging, so they age out of the 60s live window.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getOrCreateSessionId, getVisitorId, isLikelyBot } from "@/lib/visitorSession";

const SUPA_URL = "https://dqepeywgftbpxeeqfuwt.supabase.co";
const SUPA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk";

const HEARTBEAT_MS = 20_000;

function deviceOf(): string {
  const u = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(u)) return "tablet";
  if (/mobi|iphone|android.*mobile|phone/.test(u)) return "mobile";
  return "desktop";
}

export function useLiveHeartbeat(storeId: string | undefined | null) {
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!storeId) return;
    if (typeof window === "undefined") return;
    if (isLikelyBot()) return;
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/")
    ) {
      return;
    }

    const sid = getOrCreateSessionId();
    const vid = getVisitorId();
    const device = deviceOf();
    let stopped = false;

    const ping = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        fetch(`${SUPA_URL}/rest/v1/rpc/touch_live_session`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: SUPA_ANON,
            Authorization: `Bearer ${SUPA_ANON}`,
          },
          body: JSON.stringify({
            _store_id: storeId,
            _session_id: sid,
            _visitor_id: vid || null,
            _path: pathRef.current.slice(0, 200),
            _device: device,
          }),
        }).catch(() => {});
      } catch {}
    };

    ping();
    const id = window.setInterval(ping, HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // Re-run on path change so the current page is refreshed immediately.
  }, [storeId, pathname]);
}
