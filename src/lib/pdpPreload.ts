/**
 * Lightweight "preload" cache for PDP route transitions.
 *
 * When a shopper taps a product card, we stash the product's image/name/price
 * into a module-level + sessionStorage entry. The Suspense fallback
 * (ProductDetailSkeleton) reads this and paints the real LCP image + title
 * IMMEDIATELY — so the route change feels app-instant instead of showing a
 * gray placeholder while the chunk downloads.
 *
 * Cleared after the real PDP mounts.
 */

export interface PdpPreload {
  slug: string;
  image: string;
  name: string;
  price: number | null;
  salePrice: number | null;
  currency: string;
}

const KEY = "__sf_pdp_preload__";
let mem: PdpPreload | null = null;

export function setPdpPreload(p: PdpPreload) {
  mem = p;
  try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

export function getPdpPreload(slug?: string): PdpPreload | null {
  if (mem && (!slug || mem.slug === slug)) return mem;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PdpPreload;
    if (!slug || p.slug === slug) return p;
  } catch {}
  return null;
}

export function clearPdpPreload() {
  mem = null;
  try { sessionStorage.removeItem(KEY); } catch {}
}
