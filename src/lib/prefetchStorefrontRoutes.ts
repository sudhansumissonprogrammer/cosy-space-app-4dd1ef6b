/**
 * Prefetch storefront page chunks during idle time.
 * Phase 2 #7: Reduced eager prefetch from 8 → 3 most-used routes.
 * The rest are lazy-loaded on hover/touch via prefetchOnInteraction().
 */
const eagerImports = [
  // Top 3 — accounts for ~85% of navigations
  () => import("@/pages/ProductDetail"),
  () => import("@/pages/CartPage"),
  () => import("@/pages/CheckoutPage"),
  // Search overlay — used across every theme; prefetch so first click opens instantly
  () => import("@/components/storefront/StorefrontSearchOverlay"),
];

const lazyImports: Record<string, () => Promise<unknown>> = {
  category: () => import("@/pages/CategoryDetail"),
  shop: () => import("@/pages/StorefrontShop"),
  wishlist: () => import("@/pages/WishlistPage"),
  contact: () => import("@/pages/StorefrontContact"),
  bestSellers: () => import("@/pages/StorefrontBestSellers"),
};

let prefetched = false;
const interactionLoaded = new Set<string>();

const PREFETCH_START_DELAY_MS = 2000;

function shouldPrefetch() {
  const nav = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
      downlink?: number;
    };
    deviceMemory?: number;
  };

  const connection = nav.connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /(?:^|-)2g|3g/.test(connection.effectiveType)) return false;
  if (typeof connection?.downlink === "number" && connection.downlink < 1.5) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return false;

  return true;
}

/**
 * Prefetch a less-used route on user intent (hover/touch on a link).
 * Each route only loads once per session.
 */
export function prefetchOnInteraction(key: keyof typeof lazyImports) {
  if (interactionLoaded.has(key)) return;
  interactionLoaded.add(key);
  lazyImports[key]?.().catch(() => interactionLoaded.delete(key));
}

export function prefetchStorefrontRoutes() {
  if (prefetched || !shouldPrefetch()) return;
  prefetched = true;

  const schedule = typeof requestIdleCallback === "function"
    ? (cb: (deadline?: IdleDeadline) => void) => requestIdleCallback(cb, { timeout: 2000 })
    : (cb: (deadline?: IdleDeadline) => void) => setTimeout(() => cb(undefined), 300);

  let idx = 0;
  function loadNext(deadline?: IdleDeadline) {
    if (deadline && deadline.timeRemaining() < 8) {
      schedule(loadNext);
      return;
    }
    if (idx >= eagerImports.length) return;
    const imp = eagerImports[idx++];
    imp().catch(() => {});
    schedule(loadNext);
  }

  const start = () => {
    setTimeout(() => schedule(loadNext), PREFETCH_START_DELAY_MS);
  };

  if (document.readyState === "complete") {
    start();
    return;
  }

  window.addEventListener("load", start, { once: true });
}
