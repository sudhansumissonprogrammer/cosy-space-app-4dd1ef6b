/**
 * Prefetch storefront page chunks during idle time.
 * v8: CategoryDetail promoted to eager (high click-rate from category cards),
 * prefetch start delay reduced 800→400ms, exposed prefetchOnInteraction for
 * categories so hovering/touching a category link warms its chunk.
 */
const lazyImports: Record<string, () => Promise<unknown>> = {
  category: () => import("@/pages/CategoryDetail"),
  shop: () => import("@/pages/StorefrontShop"),
  wishlist: () => import("@/pages/WishlistPage"),
  contact: () => import("@/pages/StorefrontContact"),
  bestSellers: () => import("@/pages/StorefrontBestSellers"),
};

/**
 * Prefetch a less-used route on user intent (hover/touch on a link).
 * Each route only loads once per session.
 */
const interactionLoaded = new Set<string>();

export function prefetchOnInteraction(key: keyof typeof lazyImports) {
  if (interactionLoaded.has(key)) return;
  interactionLoaded.add(key);
  lazyImports[key]?.().catch(() => interactionLoaded.delete(key));
}

/** Route loading is now driven by specific link/product intent, not an idle sweep. */
export function prefetchStorefrontRoutes() {}
