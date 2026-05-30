/**
 * Phase A — Worker edge cache helpers for PDP + Category.
 *
 * Production hosts hit the Cloudflare Worker endpoints (KV + Cache API),
 * which proxy the new RPCs. Localhost / Lovable previews fall back to
 * direct Supabase RPC via the supabase client passed in.
 */

/**
 * IMPORTANT: Must match Cloudflare Worker `_buildCategoryCacheKey` /
 * `_fetchCategoryFromDb` limit (currently 50, suffix ":l50" on cache keys).
 * Changing one without the other silently invalidates every category cache.
 */
export const CATEGORY_PAGE_LIMIT = 50;

export function isProductionHost(): boolean {

  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  const isLocal = h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h);
  const isPreview = h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com");
  return !isLocal && !isPreview;
}

export async function fetchPdpEdge(productSlug: string): Promise<any | null> {
  if (!isProductionHost()) return null;
  try {
    const url = `${window.location.origin}/api/pdp?slug=${encodeURIComponent(productSlug)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.product ? data : null;
  } catch {
    return null;
  }
}

export async function fetchCategoryEdge(categorySlug: string, limit = CATEGORY_PAGE_LIMIT): Promise<any | null> {
  if (!isProductionHost()) return null;
  try {
    const url = `${window.location.origin}/api/category?slug=${encodeURIComponent(categorySlug)}&limit=${limit}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.category ? data : null;
  } catch {
    return null;
  }
}
