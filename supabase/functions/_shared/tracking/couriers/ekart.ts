import { fetchWithTimeout } from "../../http.ts";
import {
  mapByKeywords, NormalizedEvent, NormalizedTracking,
  TrackContext, TrackingAdapter,
} from "../types.ts";

/** Ekart direct integration (merchant code + auth key). */
export const ekartAdapter: TrackingAdapter = {
  slug: "ekart",
  displayName: "Ekart Logistics",
  supportsApi: true,
  officialUrl: (awb) => `https://ekartlogistics.com/track/${encodeURIComponent(awb)}`,

  async track(ctx: TrackContext): Promise<NormalizedTracking> {
    const cfg = await ctx.loadProvider("ekart");
    const base = cfg?.extra?.base_url ?? "https://api.ekartlogistics.com";
    const r = await fetchWithTimeout(
      `${base}/v2/shipments/track/${encodeURIComponent(ctx.awb)}`,
      {
        headers: {
          "X-Merchant-Code": cfg.client_id ?? "",
          "X-Api-Auth-Key": cfg.api_key ?? "",
          Accept: "application/json",
        },
        timeoutMs: 12_000,
      },
    );
    const body = await r.text();
    if (!r.ok) throw new Error(`ekart track [${r.status}]: ${body}`);
    const data = JSON.parse(body);

    const list: any[] = data?.tracking_events ?? data?.events ?? data?.[0]?.events ?? [];
    const events: NormalizedEvent[] = list
      .map((e) => ({
        status: mapByKeywords(`${e?.status ?? ""} ${e?.remarks ?? ""} ${e?.event_type ?? ""}`),
        rawStatus: e?.status ?? e?.event_type ?? null,
        description: e?.remarks ?? e?.status ?? null,
        location: e?.city ?? e?.location ?? null,
        eventTime: toIso(e?.event_date ?? e?.timestamp),
      }))
      .sort((a, b) => +new Date(b.eventTime) - +new Date(a.eventTime));

    const latest = events[0];
    return {
      status: latest?.status ?? mapByKeywords(data?.status),
      currentLocation: latest?.location ?? null,
      estimatedDelivery: data?.expected_delivery_date ? toIso(data.expected_delivery_date) : null,
      officialUrl: ekartAdapter.officialUrl(ctx.awb),
      events,
    };
  },
};

function toIso(v: unknown): string {
  const d = v ? new Date(String(v)) : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
