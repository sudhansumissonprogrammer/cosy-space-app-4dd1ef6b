/**
 * Warm a category page BEFORE the user taps it.
 *
 * The Worker already serves /api/category from KV/edge cache (~20-40ms warm),
 * but that request only starts after the click. On mobile (no hover) the RTT
 * plus React chunk boot is still ~200-400ms of visible blank/skeleton.
 *
 * This module fires the same request on pointerover / touchstart / viewport
 * intersection, so by the time the route mounts the payload is already in
 * memory and CategoryDetail can hydrate synchronously.
 *
 * Two fire-and-forget side effects, idempotent per slug:
 *   1. JS chunk: import("@/pages/CategoryDetail")
 *   2. Data: fetchCategoryEdge(slug, CATEGORY_PAGE_LIMIT) — the SAME limit the
 *      Worker prewarms (`:l50`), so the key matches and it's a cache HIT.
 * Photos are requested only by the destination page after navigation.
 */

import { fetchCategoryEdge, CATEGORY_PAGE_LIMIT } from "@/lib/storefrontEdgeApi";

let chunkLoaded = false;

/** Prefetched category payloads keyed by slug; consumed by CategoryDetail.tsx */
export const categoryPrefetchCache = new Map<string, Promise<any | null>>();

/** Synchronously readable copy — lets CategoryDetail hydrate with zero loading state. */
export const categoryPrefetchResolved = new Map<string, any>();

export function prefetchCategory(categorySlug?: string | null) {
  if (!chunkLoaded) {
    chunkLoaded = true;
    import("@/pages/CategoryDetail").catch(() => {
      chunkLoaded = false;
    });
  }

  const slug = categorySlug?.trim();
  if (!slug || categoryPrefetchCache.has(slug)) return;

  const p = fetchCategoryEdge(slug, CATEGORY_PAGE_LIMIT)
    .catch(() => null);

  categoryPrefetchCache.set(slug, p);

  // Don't let a failed/empty prefetch poison the real fetch on click.
  p.then((d) => {
    if (!d) categoryPrefetchCache.delete(slug);
    else categoryPrefetchResolved.set(slug, d);
  });
}

/** Pull `<slug>` out of any /category/<slug> href. */
function slugFromHref(href: string): string | null {
  const m = href.match(/\/category\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

let listenerInstalled = false;

/**
 * One delegated listener covering EVERY category link in every theme —
 * quick-jump pills, circle carousels, grids, nav menus — without touching
 * 20 components. Fires on hover (desktop) and first touch (mobile), which
 * on mobile buys the ~80-120ms between touchstart and click.
 */
export function installCategoryLinkPrefetch() {
  if (listenerInstalled || typeof document === "undefined") return () => {};
  listenerInstalled = true;

  const handler = (e: Event) => {
    const target = e.target as HTMLElement | null;
    const anchor = target?.closest?.("a[href*='/category/']") as HTMLAnchorElement | null;
    if (!anchor) return;
    const slug = slugFromHref(anchor.getAttribute("href") || "");
    if (slug) prefetchCategory(slug);
  };

  document.addEventListener("pointerover", handler, { passive: true, capture: true });
  document.addEventListener("touchstart", handler, { passive: true, capture: true });

  return () => {
    document.removeEventListener("pointerover", handler, true);
    document.removeEventListener("touchstart", handler, true);
    listenerInstalled = false;
  };
}
