import { fetchWithTimeout } from "../../http.ts";
import {
  mapByKeywords, NormalizedEvent, NormalizedTracking,
  TrackContext, TrackingAdapter,
} from "../types.ts";

/** Delhivery direct integration (Delhivery One API token). */
export const delhiveryAdapter: TrackingAdapter = {
  slug: "delhivery",
  displayName: "Delhivery",
  supportsApi: true,
  officialUrl: (awb) => `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`,

  async track(ctx: TrackContext): Promise<NormalizedTracking> {
    const cfg = await ctx.loadProvider("delhivery");
    const base = cfg.sandbox ? "https://staging-express.delhivery.com" : "https://track.delhivery.com";
    const r = await fetchWithTimeout(
      `${base}/api/v1/packages/json/?waybill=${encodeURIComponent(ctx.awb)}`,
      { headers: { Authorization: `Token ${cfg.api_key}`, Accept: "application/json" }, timeoutMs: 12_000 },
    );
    const body = await r.text();
    if (!r.ok) throw new Error(`delhivery track [${r.status}]: ${body}`);
    const data = JSON.parse(body);

    const shipment = data?.ShipmentData?.[0]?.Shipment ?? {};
    const scans: any[] = shipment?.Scans ?? [];

    const events: NormalizedEvent[] = scans
      .map((s) => {
        const d = s?.ScanDetail ?? s;
        return {
          status: mapByKeywords(`${d?.Scan ?? ""} ${d?.Instructions ?? ""} ${d?.ScanType ?? ""}`),
          rawStatus: d?.Scan ?? null,
          description: d?.Instructions ?? d?.Scan ?? null,
          location: d?.ScannedLocation ?? null,
          eventTime: toIso(d?.ScanDateTime),
        } as NormalizedEvent;
      })
      .sort((a, b) => +new Date(b.eventTime) - +new Date(a.eventTime));

    const latest = events[0];
    return {
      status: latest?.status ?? mapByKeywords(shipment?.Status?.Status),
      currentLocation: latest?.location ?? shipment?.Status?.StatusLocation ?? null,
      estimatedDelivery: shipment?.ExpectedDeliveryDate ? toIso(shipment.ExpectedDeliveryDate) : null,
      officialUrl: delhiveryAdapter.officialUrl(ctx.awb),
      events,
    };
  },
};

function toIso(v: unknown): string {
  const d = v ? new Date(String(v)) : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
