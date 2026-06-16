// Strict analytics helpers — visitor + session IDs.
//
// visitor_id: persistent (2y), identifies the same person across visits.
//             Already managed in metaEnrichment as sf_vid.
// session_id: 30-min sliding window. Resets after 30 min of inactivity.
//             Matches GA4 / Plausible / Shopify session semantics.
// is_bot:     cheap UA-based bot filter. Most bots don't run JS so they
//             never reach the beacon, but we still defend against the
//             few that do (PhantomJS, headless Chrome with default UA).

import { getOrCreateSfVid } from "@/lib/metaEnrichment";

const SESSION_KEY = "__sf_sess__";
const SESSION_TS_KEY = "__sf_sess_ts__";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function genId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return genId();
  try {
    const now = Date.now();
    const lastTs = Number(localStorage.getItem(SESSION_TS_KEY) || 0);
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && lastTs && now - lastTs < SESSION_TTL_MS) {
      localStorage.setItem(SESSION_TS_KEY, String(now));
      return existing;
    }
    const fresh = genId();
    localStorage.setItem(SESSION_KEY, fresh);
    localStorage.setItem(SESSION_TS_KEY, String(now));
    return fresh;
  } catch {
    return genId();
  }
}

export function getVisitorId(): string | null {
  try {
    return getOrCreateSfVid();
  } catch {
    return null;
  }
}

// NOTE: "whatsapp" intentionally NOT in this regex. Indian WhatsApp-commerce
// traffic taps product links from WhatsApp; the in-app browser sometimes
// carries "WhatsApp/..." in the UA. Treating those as bots silently zeroed
// out Live Visitors / Sessions for our biggest channel. Link-preview bots
// from WhatsApp are deduped via the 30-min visitor+path window anyway.
const BOT_UA_RE =
  /bot|crawler|spider|crawling|facebookexternalhit|telegrambot|slackbot|discordbot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|googleimageproxy|preview|monitor|uptime|pingdom|axios|curl|wget|python-requests|go-http-client|java\/|okhttp|httpclient/i;

export function isLikelyBot(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    if ((navigator as any).webdriver === true) return true;
    const ua = navigator.userAgent || "";
    if (BOT_UA_RE.test(ua)) return true;
    return false;
  } catch {
    return false;
  }
}
