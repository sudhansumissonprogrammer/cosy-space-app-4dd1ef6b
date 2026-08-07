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

interface Endpoint {
  url: (awb: string) => string;
  method?: "GET" | "POST";
  body?: (awb: string) => unknown;
  headers?: Record<string, string>;
}

/** Public feeds, tried in order until one yields events. */
const PUBLIC_ENDPOINTS: Record<string, Endpoint[]> = {
  delhivery: [
    { url: (a) => `https://dlv-web.delhivery.com/api/v1/track/package/${enc(a)}` },
    { url: (a) => `https://www.delhivery.com/api/track/package/${enc(a)}` },
  ],
  xpressbees: [
    { url: (a) => `https://ship.xpressbees.com/api/shipments2/track/${enc(a)}` },
    {
      url: () => "https://shipment.xpressbees.com/api/tracking/shipmentdetails1",
      method: "POST",
      body: (a) => ({ AWB: a }),
    },
  ],
  shadowfax: [
    { url: (a) => `https://tracker.shadowfax.in/api/v1/tracking/${enc(a)}/` },
    { url: (a) => `https://tracker.shadowfax.in/api/v2/consignment/${enc(a)}/` },
  ],
  ecom_express: [
    { url: (a) => `https://ecomexpress.in/api/track/?awb=${enc(a)}` },
    { url: (a) => `https://plapi.ecomexpress.in/track_me/api/mawbd/?awb=${enc(a)}` },
  ],
  dtdc: [
    {
      url: () => "https://trackcourier.io/api/v1/dtdc",
      method: "POST",
      body: (a) => ({ awb: a }),
    },
  ],
};

const enc = encodeURIComponent;

export function hasPublicFeed(slug: string) {
  return !!PUBLIC_ENDPOINTS[slug]?.length;
}

/** Fetch + normalize a public courier feed. Throws when nothing usable. */
export async function publicTrack(slug: string, awb: string, officialUrl: string | null): Promise<NormalizedTracking> {
  const endpoints = PUBLIC_ENDPOINTS[slug] ?? [];
  if (!endpoints.length) throw new Error(`${slug}: no public tracking feed`);
  if (!awb) throw new Error("missing AWB");

  const errors: string[] = [];

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
