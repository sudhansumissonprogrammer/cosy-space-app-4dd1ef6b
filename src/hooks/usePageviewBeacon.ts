// Client-side pageview beacon — strict accuracy + rich dimensions.
//
// v8.50.0: now captures referrer, UTM params, device/browser/os derived from UA.
// All new dimensions are nullable, so existing pipelines keep working.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  getOrCreateSessionId,
  getVisitorId,
  isLikelyBot,
} from "@/lib/visitorSession";

// Supabase REST endpoint constants — same project the auto-gen client uses.
// We hit REST directly via fetch+keepalive so the pageview never opens a CORS
// preflight or steals a TCP slot from product image downloads on cold paint.
const SUPA_URL = "https://dqepeywgftbpxeeqfuwt.supabase.co";
const SUPA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk";

const LANDING_KEY = "__sf_landing__";
const UTM_KEY = "__sf_utm__";

function parseDevice(ua: string): { device: string; browser: string; os: string } {
  const u = ua.toLowerCase();
  let device = "desktop";
  if (/ipad|tablet|playbook|silk/.test(u)) device = "tablet";
  else if (/mobi|iphone|android.*mobile|phone/.test(u)) device = "mobile";

  let browser = "other";
  if (/edg\//.test(u)) browser = "edge";
  else if (/chrome|crios/.test(u) && !/edg\//.test(u)) browser = "chrome";
  else if (/firefox|fxios/.test(u)) browser = "firefox";
  else if (/safari/.test(u) && !/chrome|crios/.test(u)) browser = "safari";
  else if (/opr\//.test(u)) browser = "opera";

  let os = "other";
  if (/windows/.test(u)) os = "windows";
  else if (/android/.test(u)) os = "android";
  else if (/iphone|ipad|ipod|ios/.test(u)) os = "ios";
  else if (/mac os x/.test(u)) os = "macos";
  else if (/linux/.test(u)) os = "linux";

  return { device, browser, os };
}

function captureUtmAndLanding(pathname: string) {
  try {
    const url = new URL(window.location.href);
    const utm = {
      utm_source: url.searchParams.get("utm_source"),
      utm_medium: url.searchParams.get("utm_medium"),
      utm_campaign: url.searchParams.get("utm_campaign"),
      utm_term: url.searchParams.get("utm_term"),
      utm_content: url.searchParams.get("utm_content"),
    };
    // Persist UTM + landing for the session (first hit wins).
    if (!sessionStorage.getItem(UTM_KEY)) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    }
    if (!sessionStorage.getItem(LANDING_KEY)) {
      sessionStorage.setItem(LANDING_KEY, pathname.slice(0, 500));
    }
  } catch {}
}

function getSessionAttribution(): {
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  utm_term: string | null; utm_content: string | null; landing_path: string | null;
} {
  try {
    const utmRaw = sessionStorage.getItem(UTM_KEY);
    const landing = sessionStorage.getItem(LANDING_KEY);
    const utm = utmRaw ? JSON.parse(utmRaw) : {};
    return {
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_term: utm.utm_term || null,
      utm_content: utm.utm_content || null,
      landing_path: landing || null,
    };
  } catch {
    return {
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_term: null, utm_content: null, landing_path: null,
    };
  }
}

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

    captureUtmAndLanding(pathname);

    const vid = getVisitorId();
    const sid = getOrCreateSessionId();
    const bot = isLikelyBot();

    try {
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const dedupKey = `pv:${vid || sid}:${pathname}:${hourBucket}`;
      if (sessionStorage.getItem(dedupKey)) return;
      sessionStorage.setItem(dedupKey, "1");
    } catch {}

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const { device, browser, os } = parseDevice(ua);
    const attrib = getSessionAttribution();
    const referrer = typeof document !== "undefined" && document.referrer
      ? document.referrer.slice(0, 500)
      : null;

    // Fire pageview AFTER first paint via fetch+keepalive (sendBeacon can't
    // set the apikey/Authorization headers PostgREST needs). keepalive=true
    // has the same fire-and-forget semantics as sendBeacon and survives
    // unload. requestIdleCallback ensures it never races the LCP fetch.
    const payload = JSON.stringify({
      store_id: storeId,
      path: pathname.slice(0, 500),
      visitor_id: vid || null,
      session_id: sid,
      is_bot: bot,
      referrer,
      device,
      browser,
      os,
      ...attrib,
    });

    const send = () => {
      try {
        fetch(`${SUPA_URL}/rest/v1/page_views`, {
          method: "POST",
          keepalive: true,
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPA_ANON,
            Authorization: `Bearer ${SUPA_ANON}`,
            Prefer: "return=minimal",
          },
          body: payload,
        }).catch(() => {});
      } catch {}
    };

    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(send, { timeout: 2500 });
    } else {
      setTimeout(send, 1500);
    }
  }, [storeId, pathname]);
}
