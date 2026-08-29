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
  return hasCustomPdpSections(store);
}

/* ------------------------------------------------------------------ *
 * Gold-plated / imitation jewellery stores.
 * They get the jewellery quality-assurance grid + the COD assurance
 * strip (with a "Partial COD" label when partial payment is on) — but
 * NOT the watch-store packaging add-ons or category-filter hiding.
 * ------------------------------------------------------------------ */
export const JEWELLERY_PDP_STORE_IDS = new Set<string>([
  "771a3012-393c-421a-b1c9-2ca918e6917f", // serdiyajewellers  → serdiyajewellers.shop
  "04010cad-1cbe-40ac-b818-07d9a79c1bf7", // serdiyajewels     → serdiya.com
  "96dd4090-c3c8-431b-be1e-ab700dd3b30a", // serdiya           → serdiyajewellers.in
  "e62eade0-acc0-4dfd-891d-3580d7d9e5f4", // sanwariyaimitation
  "5fb2aa02-79dc-4f14-9dcf-ab410730b394", // shakshiimitation
  "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9", // imitationworld
]);

export const JEWELLERY_PDP_STORE_SLUGS = new Set<string>([
  "serdiyajewellers",
  "serdiyajewels",
  "serdiya",
  "sanwariyaimitation",
  "shakshiimitation",
  "imitationworld",
]);

export function hasJewelleryPdpSections(store?: StoreLike): boolean {
  if (!store) return false;
  if (typeof store === "string") {
    return JEWELLERY_PDP_STORE_IDS.has(store) || JEWELLERY_PDP_STORE_SLUGS.has(store);
  }
  if (store.id && JEWELLERY_PDP_STORE_IDS.has(store.id)) return true;
  return !!store.slug && JEWELLERY_PDP_STORE_SLUGS.has(store.slug);
}
