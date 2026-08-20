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

// v2 (capacity work): 20s → 30s. The DB live window was widened 60s → 90s in
// the same change, so a visitor still registers 2–3 pings per window while we
// write 33% fewer rows. Idle tabs (no interaction for 10 min) stop pinging
// entirely and resume on the next interaction.
const HEARTBEAT_MS = 30_000;
const IDLE_CUTOFF_MS = 10 * 60_000;

function deviceOf(): string {
  const u = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(u)) return "tablet";
  if (/mobi|iphone|android.*mobile|phone/.test(u)) return "mobile";
  return "desktop";
}

// The same page can be reached on two URL shapes: the custom domain
// (`/category/ring-1`) and the platform path form (`/store/<slug>/category/ring-1`).
// Without normalising, "Top pages right now" splits one page into two rows and
// the store home shows up as the odd-looking `/store/<slug>`.
function normalizePath(p: string): string {
  const stripped = p.replace(/^\/store\/[^/]+/, "");
  return stripped === "" || stripped === "/" ? "/" : stripped;
}

export function useLiveHeartbeat(storeId: string | undefined | null) {
  const { pathname } = useLocation();
  const pathRef = useRef(normalizePath(pathname));
  pathRef.current = normalizePath(pathname);


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
    let lastActive = Date.now();

    const markActive = () => {
      lastActive = Date.now();
    };

    const ping = (force = false) => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      // Parked tab: visible but untouched for 10+ min — stop writing rows.
      if (!force && Date.now() - lastActive > IDLE_CUTOFF_MS) return;
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
