import { fetchWithTimeout } from "../../http.ts";
import { shiprocketToken } from "../../shipping.ts";
import {
  hashEvent, mapByKeywords, NormalizedEvent, NormalizedTracking,
  TrackContext, TrackingAdapter,
} from "../types.ts";

/**
 * Shiprocket aggregator — covers Blue Dart, DTDC, Ekart, Xpressbees, Delhivery
 * and 20+ other couriers behind one API.
 */
export const shiprocketAdapter: TrackingAdapter = {
  slug: "shiprocket",
  displayName: "Shiprocket",
  supportsApi: true,
  officialUrl: (awb) => `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`,

  async track(ctx: TrackContext): Promise<NormalizedTracking> {
    const cfg = await ctx.loadProvider("shiprocket");
    const token = await shiprocketToken(cfg);
    const r = await fetchWithTimeout(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(ctx.awb)}`,
      { headers: { Authorization: `Bearer ${token}` }, timeoutMs: 12_000 },
    );
    const body = await r.text();
    if (!r.ok) throw new Error(`shiprocket track [${r.status}]: ${body}`);
    const data = JSON.parse(body);

    const td = data?.tracking_data ?? data?.[0]?.tracking_data ?? {};
    const activities: any[] = td?.shipment_track_activities ?? [];
    const head = (td?.shipment_track ?? [])[0] ?? {};

    const events: NormalizedEvent[] = activities.map((a) => ({
      status: mapByKeywords(`${a.status ?? ""} ${a.activity ?? ""}`),
      rawStatus: a.status ?? null,
      description: a.activity ?? a.status ?? null,
      location: a.location ?? null,
      eventTime: toIso(a.date),
    }));

    const latest = events[0];
    return {
      status: latest?.status ?? mapByKeywords(head.current_status),
      currentLocation: latest?.location ?? null,
      estimatedDelivery: head.edd ? toIso(head.edd) : null,
      officialUrl: td?.track_url ?? shiprocketAdapter.officialUrl(ctx.awb),
      events: dedupe(events),
    };
  },
};

function toIso(v: unknown): string {
  const d = v ? new Date(String(v).replace(" ", "T")) : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function dedupe(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const h = hashEvent(e);
    if (seen.has(h)) return false;
    seen.add(h);
    return true;
  });
}
