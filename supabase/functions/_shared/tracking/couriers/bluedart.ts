// Blue Dart — keyless tracking by scraping the public result page.
//
// Blue Dart's JSON gateway needs a licence key, but the guest result page
// renders the full scan table server-side, so a plain GET is enough.
// The parser is tolerant: it reads every table row and keeps the ones that
// carry a date + a description, so a cosmetic markup change won't break it.

import { fetchWithTimeout } from "../../http.ts";
import { mapByKeywords, NormalizedEvent, NormalizedTracking } from "../types.ts";

const PAGE = (awb: string) =>
  `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${encodeURIComponent(awb)}`;

export async function bluedartTrack(awb: string, officialUrl: string | null): Promise<NormalizedTracking> {
  if (!awb) throw new Error("missing AWB");

  const r = await fetchWithTimeout(PAGE(awb), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    timeoutMs: 15_000,
  });
  const html = await r.text();
  if (!r.ok) throw new Error(`bluedart HTTP ${r.status}`);
  if (/no information|not found|invalid waybill/i.test(html)) throw new Error("bluedart: waybill not found");

  const events = parseRows(html);
  if (!events.length) throw new Error("bluedart: no scans yet");

  events.sort((a, b) => +new Date(b.eventTime) - +new Date(a.eventTime));
  return {
    status: events[0].status,
    currentLocation: events[0].location ?? null,
    estimatedDelivery: null,
    officialUrl: officialUrl ?? PAGE(awb),
    events,
  };
}

const DATE_RE = /^(\d{1,2})[-/\s]([A-Za-z]{3,}|\d{1,2})[-/\s](\d{2,4})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function parseRows(html: string): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const seen = new Set<string>();

  for (const row of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(clean).filter((c) => c.length > 0);
    if (cells.length < 2) continue;

    const dateCell = cells.find((c) => DATE_RE.test(c));
    if (!dateCell) continue;
    const timeCell = cells.find((c) => TIME_RE.test(c));

    const rest = cells.filter((c) => c !== dateCell && c !== timeCell);
    if (!rest.length) continue;
    // Longest remaining cell is the scan description; the other is the place.
    const desc = rest.reduce((a, b) => (b.length > a.length ? b : a));
    const loc = rest.find((c) => c !== desc) ?? null;

    const iso = toIso(dateCell, timeCell);
    if (!iso) continue;
    const key = `${iso}|${desc}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      status: mapByKeywords(desc),
      rawStatus: desc.slice(0, 120),
      description: desc.slice(0, 240),
      location: loc,
      eventTime: iso,
    });
  }

  return out;
}

function clean(cell: string) {
  return cell
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function toIso(date: string, time?: string): string | null {
  const m = date.match(DATE_RE);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const rawMonth = m[2];
  const mm = /^\d+$/.test(rawMonth)
    ? rawMonth.padStart(2, "0")
    : MONTHS[rawMonth.slice(0, 3).toLowerCase()];
  if (!mm) return null;
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];

  const t = time?.match(TIME_RE);
  const hh = (t?.[1] ?? "00").padStart(2, "0");
  const mi = t?.[2] ?? "00";
  const ss = t?.[3] ?? "00";

  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+05:30`);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y >= 2015 && y <= 2100 ? d.toISOString() : null;
}
