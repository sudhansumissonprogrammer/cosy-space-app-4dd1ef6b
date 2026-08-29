// Blue Dart — official "Track Shipment" API (RoutingServlet, verno 1.3).
//
// Why not scrape the website any more:
// Blue Dart's guest result page (`/web/guest/trackdartresult`) is now a
// Liferay portlet whose track form carries a captcha (`captchaToken` +
// `captchaText`, validated through `validateCaptcha`), and a plain GET with
// `trackNo=` only returns the empty search page. The old scraper therefore
// could never return scans. The universal 17TRACK fallback is bot-blocked too
// (it answers `meta.code -14`). So Blue Dart is now tracked the supported way:
// the merchant's own Login ID + Licence Key.
//
// Two transports, same query contract:
//   1. api.bluedart.com/servlet/RoutingServlet            (legacy, keyless host)
//   2. apigateway.bluedart.com/in/transportation/tracking (JWT via ClientID/secret)
// (2) is used when the merchant also saved API-gateway credentials.

import { fetchWithTimeout } from "../../http.ts";
import {
  mapByKeywords, NormalizedEvent, NormalizedTracking, TrackContext, TrackingAdapter,
} from "../types.ts";

const LEGACY_HOST = "https://api.bluedart.com/servlet/RoutingServlet";
const GATEWAY_TRACK = "https://apigateway.bluedart.com/in/transportation/tracking/v1/shipment";
const GATEWAY_TOKEN = "https://apigateway.bluedart.com/in/transportation/token/v1/login";

export const bluedartAdapter: TrackingAdapter = {
  slug: "bluedart",
  displayName: "Blue Dart",
  supportsApi: true,
  officialUrl: (awb) =>
    `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${encodeURIComponent(awb)}`,

  async track(ctx: TrackContext): Promise<NormalizedTracking> {
    const cfg = await ctx.loadProvider("bluedart");
    return await bluedartTrackWithCreds(ctx.awb, {
      loginId: str(cfg?.client_id),
      licenceKey: str(cfg?.api_key),
      gatewayClientId: str(cfg?.api_email),
      gatewayClientSecret: str(cfg?.api_secret),
    }, bluedartAdapter.officialUrl(ctx.awb));
  },
};

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

export interface BlueDartCreds {
  loginId: string | null;
  licenceKey: string | null;
  gatewayClientId?: string | null;
  gatewayClientSecret?: string | null;
}

export async function bluedartTrackWithCreds(
  awb: string,
  creds: BlueDartCreds,
  officialUrl: string | null,
): Promise<NormalizedTracking> {
  if (!awb) throw new Error("missing AWB");
  if (!creds.loginId || !creds.licenceKey) {
    throw new Error(
      "Blue Dart tracking needs your Blue Dart Login ID and Licence Key " +
      "(Shipping Integrations → Blue Dart). Blue Dart's public page is captcha-protected, " +
      "so AWBs cannot be fetched without them.",
    );
  }

  const qs = new URLSearchParams({
    handler: "tnt",
    action: "custawbquery",
    loginid: creds.loginId,
    awb: "awb",
    numbers: awb.trim(),
    format: "xml",
    lickey: creds.licenceKey,
    verno: "1.3",
    scan: "1",
  }).toString();

  const useGateway = !!(creds.gatewayClientId && creds.gatewayClientSecret);
  const headers: Record<string, string> = { Accept: "application/xml,text/xml,*/*" };
  let url = `${LEGACY_HOST}?${qs}`;

  if (useGateway) {
    headers.JWTToken = await gatewayToken(creds.gatewayClientId!, creds.gatewayClientSecret!);
    url = `${GATEWAY_TRACK}?${qs}`;
  }

  const r = await fetchWithTimeout(url, { headers, timeoutMs: 15_000, retryOnNetworkError: true });
  const xml = await r.text();
  if (!r.ok) throw new Error(`bluedart HTTP ${r.status}: ${xml.slice(0, 160)}`);

  const err = tag(xml, "Error") ??
    (attr(xml, "Shipment", "StatusType") === "E" ? tag(xml, "StatusInformation") : null);
  if (err) throw new Error(`bluedart: ${err.slice(0, 160)}`);

  const events = parseScans(xml);
  if (!events.length) {
    const status = tag(xml, "Status") ?? tag(xml, "StatusInformation");
    if (status) {
      return {
        status: mapByKeywords(status),
        currentLocation: tag(xml, "ScannedLocation") ?? null,
        estimatedDelivery: isoFrom(tag(xml, "ExpectedDeliveryDate"), null),
        officialUrl,
        events: [],
      };
    }
    throw new Error("bluedart: no scans yet for this waybill");
  }

  events.sort((a, b) => +new Date(b.eventTime) - +new Date(a.eventTime));
  return {
    status: events[0].status,
    currentLocation: events[0].location ?? null,
    estimatedDelivery: isoFrom(tag(xml, "ExpectedDeliveryDate"), null),
    officialUrl,
    events,
  };
}

async function gatewayToken(clientId: string, clientSecret: string): Promise<string> {
  const r = await fetchWithTimeout(GATEWAY_TOKEN, {
    headers: { ClientID: clientId, clientSecret, Accept: "application/json" },
    timeoutMs: 12_000,
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`bluedart token HTTP ${r.status}: ${body.slice(0, 120)}`);
  try {
    const t = JSON.parse(body)?.JWTToken;
    if (!t) throw new Error("no JWTToken");
    return t as string;
  } catch {
    throw new Error("bluedart: could not mint API gateway token");
  }
}

/* ------------------------------ XML parsing ------------------------------ */

/**
 * Blue Dart ships two shapes depending on account/version:
 *   <ScanDetail><Scan>..</Scan><ScanDate>..</ScanDate>..</ScanDetail>
 *   <ScanDetail Scan=".." ScanDate=".." ScanTime=".." ScannedLocation=".."/>
 * Both are handled; anything without a date + description is skipped.
 */
function parseScans(xml: string): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const seen = new Set<string>();

  const blocks = [
    ...(xml.match(/<ScanDetail\b[\s\S]*?(?:\/>|<\/ScanDetail>)/gi) ?? []),
    ...(xml.match(/<Scan\b[^>]*ScanDate=[\s\S]*?\/>/gi) ?? []),
  ];

  for (const b of blocks) {
    const desc = tag(b, "Scan") ?? attrOf(b, "Scan") ?? tag(b, "Instructions") ?? attrOf(b, "Instructions");
    const date = tag(b, "ScanDate") ?? attrOf(b, "ScanDate");
    const time = tag(b, "ScanTime") ?? attrOf(b, "ScanTime");
    const loc = tag(b, "ScannedLocation") ?? attrOf(b, "ScannedLocation") ?? tag(b, "ScanLocation");
    const extra = tag(b, "Instructions") ?? attrOf(b, "Instructions");
    if (!desc || !date) continue;

    const when = isoFrom(date, time);
    if (!when) continue;
    const key = `${when}|${desc}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const text = [desc, extra].filter(Boolean).join(" — ");
    out.push({
      status: mapByKeywords(text),
      rawStatus: desc.slice(0, 120),
      description: text.slice(0, 240),
      location: loc ?? null,
      eventTime: when,
    });
  }

  return out;
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : null;
}

function attrOf(fragment: string, name: string): string | null {
  const m = fragment.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decode(m[1]) : null;
}

function attr(xml: string, element: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${element}\\b[^>]*>`, "i"));
  return m ? attrOf(m[0], name) : null;
}

function decode(s: string): string | null {
  const v = s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return v || null;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Blue Dart stamps IST: "26 August 2026" / "26-Aug-2026" / "26/08/2026" + "1320" or "13:20". */
function isoFrom(date: string | null | undefined, time: string | null | undefined): string | null {
  if (!date) return null;
  const d = date.trim();
  const m = d.match(/^(\d{1,2})[-/\s]+([A-Za-z]{3,}|\d{1,2})[-/\s]+(\d{2,4})$/);
  let yyyy: string, mm: string, dd: string;
  if (m) {
    dd = m[1].padStart(2, "0");
    mm = /^\d+$/.test(m[2]) ? m[2].padStart(2, "0") : (MONTHS[m[2].slice(0, 3).toLowerCase()] ?? "");
    yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    if (!mm) return null;
  } else {
    const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!iso) return null;
    [, yyyy, mm, dd] = iso;
  }

  const t = (time ?? "").replace(/[^0-9:]/g, "");
  let hh = "00", mi = "00";
  if (/^\d{1,2}:\d{2}/.test(t)) { const [a, b] = t.split(":"); hh = a.padStart(2, "0"); mi = b.slice(0, 2); }
  else if (/^\d{3,4}$/.test(t)) { hh = t.padStart(4, "0").slice(0, 2); mi = t.padStart(4, "0").slice(2, 4); }

  const dt = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00+05:30`);
  if (isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  return y >= 2015 && y <= 2100 ? dt.toISOString() : null;
}
