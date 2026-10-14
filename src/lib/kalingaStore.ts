/** Kalinga Jewels (formerly Imitation World). Gate by permanent store ID so slug/domain renames never break store-only features. */
export const KALINGA_STORE_ID = "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9";
const SLUGS = new Set(["kalingajewels", "imitationworld"]);

export function isKalingaStore(store?: { id?: string | null; slug?: string | null } | null): boolean {
  if (!store) return false;
  return store.id === KALINGA_STORE_ID || SLUGS.has(String(store.slug || "").toLowerCase());
}

export function isKalingaSlugOrId(id?: string | null, slug?: string | null): boolean {
  return isKalingaStore({ id, slug });
}

/** Public contact only; never use this address for account authentication. */
export function kalingaPublicEmail(store?: { id?: string | null; slug?: string | null } | null): string | undefined {
  return isKalingaStore(store) ? "bavunisaf@gmail.com" : undefined;
}
