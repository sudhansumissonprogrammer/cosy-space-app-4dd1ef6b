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
  // Kalinga Jewels: single visible category, so the quick-jump row and the
  // sort/filter bar only add noise. Gated by immutable store ID + slugs.
  const KALINGA_ID = "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9";
  if (!store) return false;
  if (typeof store === "string") return store === KALINGA_ID || store === "kalingajewels" || store === "imitationworld";
  return store.id === KALINGA_ID || store.slug === "kalingajewels" || store.slug === "imitationworld";
}

