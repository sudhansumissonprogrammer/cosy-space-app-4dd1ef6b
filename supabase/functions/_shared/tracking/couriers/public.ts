// Credential-free ("public") courier tracking.
//
// Most Indian couriers expose the same JSON feed their own website consumes.
// We hit those endpoints directly so a merchant gets live tracking the moment
// they paste an AWB — no API keys, no onboarding.
//
// Payload shapes differ per courier and change without notice, so instead of
// hardcoding paths we run a tolerant, schema-agnostic scan: find every array
// of objects that looks like a scan list (a date-ish field + a status-ish
// field) and normalize it. If nothing is found we throw and the caller falls
// back to the merchant-maintained status — the timeline never breaks.

import { fetchWithTimeout } from "../../http.ts";
import {
  mapByKeywords, NormalizedEvent, NormalizedTracking, TrackContext, TrackingAdapter,
} from "../types.ts";
import { hasUniversalFeed, indiaPostTrack, universalTrack } from "./indiapost.ts";
import { amazonTrack } from "./amazon.ts";


interface Endpoint {
  url: (awb: string) => string;
  method?: "GET" | "POST";
  body?: (awb: string) => unknown;
  headers?: Record<string, string>;
}

/**
 * Public feeds, tried in order until one yields events.
 *
 * Only endpoints verified to answer without credentials live here — the
 * couriers whose "public" JSON is now behind auth (Xpressbees, Shadowfax,
 * Ecom Express, DTDC) were removed so we don't burn a request and log a
 * failure on every sync; they run in manual mode with a deep link instead.
 */
const PUBLIC_ENDPOINTS: Record<string, Endpoint[]> = {
  // (empty today — every verified keyless courier has a custom tracker below;
  // add a courier here the moment it exposes an open JSON feed again)
};

/** Couriers with a bespoke keyless tracker (not a plain JSON endpoint). */
const CUSTOM_TRACKERS: Record<string, (awb: string, url: string | null) => Promise<NormalizedTracking>> = {
  india_post: indiaPostTrack,
  amazon_shipping: amazonTrack,
};

const enc = encodeURIComponent;

/**
 * True when the courier can be tracked with zero merchant credentials —
 * either through its own public feed or the universal 17TRACK fallback
 * (India Post, Blue Dart, Amazon Shipping and friends land here).
 */
export function hasPublicFeed(slug: string) {
  return !!PUBLIC_ENDPOINTS[slug]?.length || !!CUSTOM_TRACKERS[slug] || hasUniversalFeed(slug);
}

/** Fetch + normalize a public courier feed. Throws when nothing usable. */
export async function publicTrack(slug: string, awb: string, officialUrl: string | null): Promise<NormalizedTracking> {
  const endpoints = PUBLIC_ENDPOINTS[slug] ?? [];
  if (!awb) throw new Error("missing AWB");
  if (!endpoints.length && !CUSTOM_TRACKERS[slug] && !hasUniversalFeed(slug)) {
    throw new Error(`${slug}: no public tracking feed`);
  }

  const errors: string[] = [];

  // Couriers with a dedicated keyless tracker (India Post portal, Amazon's
  // consumer API, Blue Dart's guest result page) go first; the universal
  // aggregator below still covers them if the courier changes shape.
  const custom = CUSTOM_TRACKERS[slug];
  if (custom) {
    try {
      return await custom(awb, officialUrl);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  for (const ep of endpoints) {

    try {
      const method = ep.method ?? "GET";
      const r = await fetchWithTimeout(ep.url(awb), {
        method,
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; ShopBanaoTracking/1.0)",
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
          ...(ep.headers ?? {}),
        },
        body: method === "POST" && ep.body ? JSON.stringify(ep.body(awb)) : undefined,
        timeoutMs: 10_000,
      });
      const text = await r.text();
      if (!r.ok) { errors.push(`[${r.status}] ${text.slice(0, 120)}`); continue; }

      let data: unknown;
      try { data = JSON.parse(text); } catch { errors.push("non-JSON response"); continue; }

      const events = scanForEvents(data);
      if (!events.length) { errors.push("no scans in payload"); continue; }

      events.sort((a, b) => +new Date(b.eventTime) - +new Date(a.eventTime));
      const latest = events[0];
      return {
        status: latest.status,
        currentLocation: latest.location ?? null,
        estimatedDelivery: findEdd(data),
        officialUrl,
        events,
      };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  // Last resort: carrier-agnostic public aggregator. Keeps the timeline alive
  // when a courier's own feed changes shape or goes down.
  if (hasUniversalFeed(slug)) {
    try {
      return await universalTrack(slug, awb, officialUrl);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  throw new Error(`${slug} public tracking unavailable: ${errors.join(" | ").slice(0, 300)}`);
}


/** Build an adapter backed purely by a public feed. */
export function publicAdapter(
  slug: string,
  displayName: string,
  url: (awb: string) => string | null,
): TrackingAdapter {
  return {
    slug,
    displayName,
    supportsApi: hasPublicFeed(slug),
    officialUrl: url,
    track: hasPublicFeed(slug)
      ? (ctx: TrackContext) => publicTrack(slug, ctx.awb, url(ctx.awb))
      : undefined,
  };
}

/* ---------------- schema-agnostic normalizer ---------------- */

const DATE_KEYS = /(date|time|timestamp|dt|scandate|updated)/i;
const TEXT_KEYS = /(status|activity|remark|instruction|description|message|scan|action|event|state)/i;
const LOC_KEYS = /(location|city|place|branch|origin|center|centre|hub|office|facility)/i;
const EDD_KEYS = /(edd|expected|promise|estimated)/i;

function scanForEvents(root: unknown): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, depth: number) => {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        const ev = toEvent(item);
        if (ev) {
          const key = `${ev.eventTime}|${ev.description ?? ""}`;
          if (!seen.has(key)) { seen.add(key); out.push(ev); }
        }
        walk(item, depth + 1);
      }
      return;
    }
    if (typeof node === "object") {
      for (const v of Object.values(node as Record<string, unknown>)) walk(v, depth + 1);
    }
  };

  walk(root, 0);
  return out;
}

function toEvent(item: unknown): NormalizedEvent | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const obj = flatten(item as Record<string, unknown>);

  let when: string | null = null;
  let text = "";
  let loc: string | null = null;

  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const val = typeof v === "string" || typeof v === "number" ? String(v) : "";
    if (!val) continue;
    if (!when && DATE_KEYS.test(k) && !EDD_KEYS.test(k)) {
      const iso = toIso(val);
      if (iso) when = iso;
    } else if (TEXT_KEYS.test(k)) {
      text += ` ${val}`;
    } else if (!loc && LOC_KEYS.test(k)) {
      loc = val;
    }
  }

  if (!when || !text.trim()) return null;
  return {
    status: mapByKeywords(text),
    rawStatus: text.trim().slice(0, 120),
    description: text.trim().slice(0, 240),
    location: loc,
    eventTime: when,
  };
}

/** One level of nesting flattened (many feeds wrap scans in `ScanDetail`). */
function flatten(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) out[`${k}_${k2}`] = v2;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function toIso(v: string): string | null {
  const s = v.trim();
  if (!s || /^\d{1,4}$/.test(s)) return null;
  // dd-mm-yyyy / dd/mm/yyyy (+ optional time) — Indian couriers' favourite.
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+05:30`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 2015 || year > 2100) return null;
  return d.toISOString();
}

function findEdd(root: unknown, depth = 0): string | null {
  if (!root || depth > 6) return null;
  if (Array.isArray(root)) {
    for (const v of root) { const r = findEdd(v, depth + 1); if (r) return r; }
    return null;
  }
  if (typeof root !== "object") return null;
  for (const [k, v] of Object.entries(root as Record<string, unknown>)) {
    if (EDD_KEYS.test(k) && (typeof v === "string" || typeof v === "number")) {
      const iso = toIso(String(v));
      if (iso) return iso;
    }
    const r = findEdd(v, depth + 1);
    if (r) return r;
  }
  return null;
}
