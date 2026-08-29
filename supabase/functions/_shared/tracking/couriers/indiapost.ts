// India Post + universal keyless tracking fallback.
//
// India Post publishes no documented API and its own site is captcha-gated,
// but two keyless feeds return real scan data:
//
//   1. The India Post portal's ASP.NET web method that the tracking page calls
//      (`GetArticleDetails`). It answers without a captcha for many articles;
//      when it doesn't, we fall through.
//   2. 17TRACK's public web endpoint (the same one t.17track.net's own site
//      uses from the browser). It aggregates India Post, Blue Dart, Amazon
//      Shipping and ~2000 more couriers with no key.
//
// Because (2) is carrier-agnostic, it doubles as a last-resort fallback for
// EVERY courier: if a courier-specific feed changes shape or goes down, we
// still show the customer a live timeline instead of a dead page.

import { fetchWithTimeout } from "../../http.ts";
import { mapByKeywords, NormalizedEvent, NormalizedTracking } from "../types.ts";

/** 17TRACK numeric carrier hints (0 = let 17TRACK auto-detect). */
const CARRIER_HINT: Record<string, number> = {
  india_post: 7041,
  dtdc: 100004,
  ecom_express: 100008,
  xpressbees: 100085,
  delhivery: 100003,
  shadowfax: 100091,
  ekart: 100061,
};

/** Couriers we can track with zero credentials via the universal fallback. */
export function hasUniversalFeed(slug: string | null | undefined) {
  return !!slug && slug !== "other" && slug in CARRIER_HINT;
}

/* ---------------------------- India Post ---------------------------- */

export async function indiaPostTrack(awb: string, officialUrl: string | null): Promise<NormalizedTracking> {
  const errors: string[] = [];

  try {
    const events = await indiaPostPortal(awb);
    if (events.length) return build(events, officialUrl);
    errors.push("portal: no scans");
  } catch (e) {
    errors.push(`portal: ${(e as Error).message}`);
  }

  // The universal aggregator retry is handled by the caller (publicTrack).
  throw new Error(`india_post tracking unavailable: ${errors.join(" | ").slice(0, 300)}`);
}

/**
 * indiapost.gov.in's current tracking feed.
 *
 * The old ASP.NET web method (`GetArticleDetails`) is gone — the portal is now
 * a Next.js app and tracking runs through two React Server Actions:
 *   1. `getTrackingToken()`  → short-lived signed nonce
 *   2. `trackArticle(token, awb)` → booking + scan details
 * Both are keyless and captcha-free. Action IDs are build-scoped, so if a
 * redeploy rotates them we fall through to the universal aggregator.
 */
const IP_PAGE = "https://www.indiapost.gov.in/track-result/article-tracking/";
const IP_ACTION_TOKEN = "00b4f44fd7cd8e5a9d969100904e4880581555ea21";
const IP_ACTION_TRACK = "60d4c45fc5727f9c4c3efc1c93b182559c9cedbaaf";

async function ipAction(actionId: string, args: unknown[]): Promise<unknown> {
  const r = await fetchWithTimeout(IP_PAGE, {
    method: "POST",
    headers: {
      "Next-Action": actionId,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Referer: IP_PAGE,
    },
    body: JSON.stringify(args),
    timeoutMs: 15_000,
  });
  // Next.js answers server actions on this route with a 404 status but a valid
  // flight body, so the status is deliberately not gated on.
  const text = await r.text();
  if (!text) throw new Error(`empty response (HTTP ${r.status})`);

  // RSC flight payload: newline-delimited `<id>:<json>` rows. The action's
  // return value is the last row that parses to something non-trivial.
  let result: unknown = null;
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const raw = line.slice(i + 1).trim();
    if (!raw || raw.startsWith("$")) continue;
    try {
      const v = JSON.parse(raw);
      if (typeof v === "string" || (v && typeof v === "object" && !("a" in (v as object)))) result = v;
    } catch { /* partial row */ }
  }
  if (result === null) throw new Error("unparsable RSC response");
  return result;
}

async function indiaPostPortal(awb: string): Promise<NormalizedEvent[]> {
  const token = await ipAction(IP_ACTION_TOKEN, []);
  if (typeof token !== "string" || !token) throw new Error("no tracking token");

  const res = await ipAction(IP_ACTION_TRACK, [token, awb.toUpperCase()]) as Record<string, any>;
  if (res?.error) throw new Error(String(res.error).slice(0, 120));
  const scans = res?.data?.tracking_details;
  if (!Array.isArray(scans) || !scans.length) return [];

  const events: NormalizedEvent[] = [];
  for (const row of scans as Record<string, unknown>[]) {
    const desc = str(row.event) ?? str(row.eventcode) ?? str(row.remarks);
    const date = str(row.date);
    if (!desc || !date) continue;
    const when = toIsoIst(date);
    if (!when) continue;
    events.push({
      status: mapByKeywords(desc),
      rawStatus: desc.slice(0, 120),
      description: [desc, str(row.remarks)].filter(Boolean).join(" — ").slice(0, 240),
      location: str(row.office),
      eventTime: when,
    });
  }
  return events;
}



/* ------------------------- Universal (17TRACK) ------------------------- */

export async function universalTrack(
  slug: string,
  awb: string,
  officialUrl: string | null,
): Promise<NormalizedTracking> {
  if (!awb) throw new Error("missing AWB");
  const carrier = CARRIER_HINT[slug] ?? 0;

  const r = await fetchWithTimeout("https://t.17track.net/restapi/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Origin: "https://t.17track.net",
      Referer: `https://t.17track.net/en#nums=${encodeURIComponent(awb)}`,
    },
    body: JSON.stringify({ data: [{ num: awb, fc: carrier, sc: 0 }] }),
    retryOnNetworkError: true,
    timeoutMs: 12_000,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`17track HTTP ${r.status}`);

  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("17track: non-JSON response"); }

  const events = parse17track(data);
  if (!events.length) throw new Error("17track: no scans yet");
  return build(events, officialUrl);
}

/**
 * 17TRACK uses terse keys that no generic scanner can guess:
 *   a = timestamp, b/c = location, z = description (legacy `z1`/`z2` arrays),
 * and a verbose shape (`shipments[].events[]`) on the newer endpoint.
 */
function parse17track(root: unknown): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const seen = new Set<string>();

  const push = (whenRaw: string, desc: string, loc: string | null) => {
    const when = toIsoIst(whenRaw);
    if (!when || !desc.trim()) return;
    const key = `${when}|${desc}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      status: mapByKeywords(desc),
      rawStatus: desc.slice(0, 120),
      description: desc.slice(0, 240),
      location: loc,
      eventTime: when,
    });
  };

  const walk = (node: unknown, depth: number) => {
    if (!node || depth > 10) return;
    if (Array.isArray(node)) { for (const n of node) walk(n, depth + 1); return; }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    // legacy terse event: { a: time, c: location, z: description }
    const a = str(o.a) ?? str(o.time_iso) ?? str(o.time_raw) ?? str(o.date) ?? str(o.eventTime);
    const z = str(o.z) ?? str(o.description) ?? str(o.status_description) ?? str(o.stage) ?? str(o.event);
    const c = str(o.c) ?? str(o.location) ?? str(o.address) ?? str(o.d);
    if (a && z) push(a, z, c ?? null);

    for (const v of Object.values(o)) walk(v, depth + 1);
  };

  walk(root, 0);
  return out;
}

/* ------------------------------ helpers ------------------------------ */

function build(events: NormalizedEvent[], officialUrl: string | null): NormalizedTracking {
  events.sort((x, y) => +new Date(y.eventTime) - +new Date(x.eventTime));
  const latest = events[0];
  return {
    status: latest.status,
    currentLocation: latest.location ?? null,
    estimatedDelivery: null,
    officialUrl,
    events,
  };
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

// deno-lint-ignore no-unused-vars
function collectRows(root: unknown, depth = 0): Record<string, unknown>[] {
  if (!root || depth > 8) return [];
  if (Array.isArray(root)) {
    const rows = root.filter((r) => r && typeof r === "object" && !Array.isArray(r)) as Record<string, unknown>[];
    const nested = root.flatMap((r) => collectRows(r, depth + 1));
    return [...rows, ...nested];
  }
  if (typeof root !== "object") return [];
  return Object.values(root as Record<string, unknown>).flatMap((v) => collectRows(v, depth + 1));
}

// deno-lint-ignore no-unused-vars
function pick(row: Record<string, unknown>, re: RegExp): string | null {
  for (const [k, v] of Object.entries(row)) {
    if (!re.test(k)) continue;
    const s = str(v);
    if (s) return s;
  }
  return null;
}

/** India Post / 17TRACK stamp times in IST without an offset. */
function toIsoIst(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const [, dd, mon, yyyy, hh = "00", mi = "00", ss = "00"] = dmy;
    const mm = /^\d+$/.test(mon) ? mon.padStart(2, "0") : monthNum(mon);
    if (mm) {
      const d = new Date(`${yyyy}-${mm}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi}:${ss}+05:30`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasZone ? s : `${s.replace(" ", "T")}+05:30`);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 2015 || y > 2100) return null;
  return d.toISOString();
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function monthNum(m: string): string | null {
  const i = MONTHS.indexOf(m.slice(0, 3).toLowerCase());
  return i === -1 ? null : String(i + 1).padStart(2, "0");
}
