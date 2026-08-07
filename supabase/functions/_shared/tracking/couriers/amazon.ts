// Amazon Shipping (track.amazon.in) — keyless public tracker.
//
// The consumer tracking page calls `GET /api/tracker/<trackingId>` and gets a
// JSON envelope whose `progressTracker` field is itself a JSON *string*.
// We parse both layers and hand the inner object to the shared scanner.

import { fetchWithTimeout } from "../../http.ts";
import { mapByKeywords, NormalizedEvent, NormalizedTracking } from "../types.ts";

const ENDPOINT = (awb: string) => `https://track.amazon.in/api/tracker/${encodeURIComponent(awb)}`;

export async function amazonTrack(awb: string, officialUrl: string | null): Promise<NormalizedTracking> {
  if (!awb) throw new Error("missing AWB");

  const r = await fetchWithTimeout(ENDPOINT(awb), {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    timeoutMs: 12_000,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`amazon HTTP ${r.status}`);

  let outer: any;
  try { outer = JSON.parse(text.trim()); } catch { throw new Error("amazon: non-JSON response"); }

  let inner: any = outer?.progressTracker;
  if (typeof inner === "string") {
    try { inner = JSON.parse(inner); } catch { inner = null; }
  }
  const root = inner ?? outer;

  const err = root?.errors?.[0]?.errorCode;
  if (err) throw new Error(`amazon: ${String(err).toLowerCase()}`);

  const events = collect(root);
  if (!events.length) throw new Error("amazon: no scans yet");

  events.sort((a, b) => +new Date(b.eventTime) - +new Date(a.eventTime));
  return {
    status: events[0].status,
    currentLocation: events[0].location ?? null,
    estimatedDelivery: null,
    officialUrl,
    events,
  };
}

/** Amazon nests scans under eventHistory[] with { eventTime, statusSummary, location }. */
function collect(root: unknown): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const seen = new Set<string>();

  const walk = (node: any, depth: number) => {
    if (!node || depth > 10) return;
    if (Array.isArray(node)) { for (const n of node) walk(n, depth + 1); return; }
    if (typeof node !== "object") return;

    const when = node.eventTime ?? node.eventDate ?? node.timestamp;
    const desc =
      node.statusSummary?.localisedStringId ??
      node.statusSummary?.value ??
      node.eventDescription ??
      node.shortStatus ??
      node.eventCode;
    if (when && typeof desc === "string") {
      const iso = toIso(String(when));
      const label = humanize(desc);
      const key = `${iso}|${label}`;
      if (iso && label && !seen.has(key)) {
        seen.add(key);
        out.push({
          status: mapByKeywords(label),
          rawStatus: String(desc).slice(0, 120),
          description: label.slice(0, 240),
          location: locationOf(node),
          eventTime: iso,
        });
      }
    }

    for (const v of Object.values(node)) walk(v, depth + 1);
  };

  walk(root, 0);
  return out;
}

function locationOf(node: any): string | null {
  const l = node.location ?? node.eventLocation ?? node.address;
  if (!l) return null;
  if (typeof l === "string") return l;
  return [l.city, l.stateProvince ?? l.state, l.countryCode].filter(Boolean).join(", ") || null;
}

/** "swa_rex_delivered" / "PACKAGE_OUT_FOR_DELIVERY" → "Delivered". */
function humanize(raw: string): string {
  const cleaned = raw.replace(/^swa[_-]/i, "").replace(/[_-]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function toIso(v: string): string | null {
  const n = Number(v);
  const d = Number.isFinite(n) && v.trim().length >= 10 ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y >= 2015 && y <= 2100 ? d.toISOString() : null;
}
