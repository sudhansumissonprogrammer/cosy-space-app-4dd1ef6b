/**
 * Store-scoped PDP sections.
 *
 * Only stores listed here load ANY of this code — the container is lazy +
 * deferred, so every other storefront pays exactly zero JS / paint cost.
 *
 * GATING IS BY STORE ID FIRST (immutable), slug second (legacy / convenience).
 * A merchant renaming their store or changing its slug must NEVER lose the
 * custom PDP sections, packaging add-ons, brand eyebrow, FAQ, etc.
 */

import { isKalingaStore, KALINGA_STORE_ID } from "@/lib/kalingaStore";

/** Immutable store UUIDs — the source of truth. */
export const PDP_CUSTOM_SECTION_STORE_IDS = new Set<string>([
  "ab19143d-87a9-490e-90b7-837313522782", // utkalwatch (formerly wristlife)
  "d07b0784-4103-494e-b243-8fcbdf5fd473", // hopknock
]);

/** Slugs kept as a fallback for paths where only the slug is known. */
export const PDP_CUSTOM_SECTION_STORES = new Set<string>([
  "utkalwatch",
  "wristlife", // legacy slug — kept so old cached HTML/links keep the sections
  "hopknock",
]);

type StoreLike = { id?: string | null; slug?: string | null } | string | null | undefined;

export function hasCustomPdpSections(store?: StoreLike): boolean {
  if (!store) return false;
  if (typeof store === "string") {
    return PDP_CUSTOM_SECTION_STORE_IDS.has(store) || PDP_CUSTOM_SECTION_STORES.has(store);
  }
  if (store.id && PDP_CUSTOM_SECTION_STORE_IDS.has(store.id)) return true;
  return !!store.slug && PDP_CUSTOM_SECTION_STORES.has(store.slug);
}

/**
 * These stores hide BOTH filter strips on a category page:
 *  - the horizontal category quick-jump row above the grid, and
 *  - the sort / filter bar under it.
 * Gated by the same immutable store IDs so nothing renders (and no category
 * query fires) for them — zero load cost, zero layout shift.
 */
export function hidesCategoryFilters(store?: StoreLike): boolean {
  if (hasCustomPdpSections(store)) return true;
  // Retain Kalinga's requested hidden strips after catalogue restoration.
  if (!store) return false;
  if (typeof store === "string") return store === KALINGA_STORE_ID || isKalingaStore({ slug: store });
  return isKalingaStore(store);
}

