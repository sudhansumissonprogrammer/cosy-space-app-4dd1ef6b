import { TrackingAdapter } from "./types.ts";
import { shiprocketAdapter } from "./couriers/shiprocket.ts";
import { delhiveryAdapter } from "./couriers/delhivery.ts";
import { ekartAdapter } from "./couriers/ekart.ts";
import { bluedartAdapter } from "./couriers/bluedart.ts";
import { manualAdapters } from "./couriers/manual.ts";

/**
 * Courier registry — the ONLY place that knows which couriers exist.
 * Adding a courier = write an adapter file and append it here.
 */
const ADAPTERS: TrackingAdapter[] = [
  shiprocketAdapter,
  delhiveryAdapter,
  ekartAdapter,
  bluedartAdapter,
  ...manualAdapters,
];

const BY_SLUG = new Map(ADAPTERS.map((a) => [a.slug, a]));

export function resolveAdapter(slug: string | null | undefined): TrackingAdapter | null {
  if (!slug) return null;
  return BY_SLUG.get(slug) ?? null;
}

export function listAdapters() {
  return ADAPTERS.map((a) => ({
    slug: a.slug,
    displayName: a.displayName,
    supportsApi: a.supportsApi,
  }));
}
