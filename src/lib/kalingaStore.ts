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

/** Confirmed public address; prevents stale shells and duplicated city/state suffixes. */
export function kalingaPublicAddress(store?: { id?: string | null; slug?: string | null } | null): string | undefined {
  return isKalingaStore(store) ? "Patasanipur, Ghiakhala, Khorda, Odisha, 752030, India" : undefined;
}

/** Normalize public presentation only, including embedded text from older edge payloads. */
export function resolveKalingaPublicStore<T extends { id?: string | null; slug?: string | null }>(store: T): T {
  if (!isKalingaStore(store)) return store;
  const resolved = { ...store } as T & Record<string, unknown>;
  for (const key of ["name", "description", "meta_title", "meta_description", "about_us_text", "shipping_policy", "return_policy"]) {
    const value = resolved[key];
    if (typeof value !== "string") continue;
    resolved[key] = value
      .replace(/imitation\s*world/gi, "Kalinga Jewels")
      .replace(/imitationworld\.in/gi, "kalingajewels.com")
      .replace(/(?:\+91\s*)?9348625925(?:[ ,]+\+91\s*9692282485)?/g, "+91 9692282485")
      .replace(/^(Address\s*:\s*).*$/gim, `$1${kalingaPublicAddress(store)}`);
  }
  Object.assign(resolved, {
    whatsapp_number: "9692282485",
    secondary_phone: null,
    owner_email: kalingaPublicEmail(store),
    owner_name: "Sudhansu Sahoo",
    location: kalingaPublicAddress(store),
    city: null,
    state: null,
  });
  return resolved;
}
