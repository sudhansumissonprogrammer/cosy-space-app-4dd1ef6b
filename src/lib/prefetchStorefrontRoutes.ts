/**
 * Prefetch storefront page chunks during idle time.
 * Called once when the storefront layout mounts.
 */
const storefrontImports = [
  () => import("@/pages/CategoryDetail"),
  () => import("@/pages/ProductDetail"),
  () => import("@/pages/CartPage"),
  () => import("@/pages/CheckoutPage"),
  () => import("@/pages/StorefrontShop"),
  () => import("@/pages/WishlistPage"),
  () => import("@/pages/StorefrontContact"),
  () => import("@/pages/StorefrontBestSellers"),
];

let prefetched = false;

const PREFETCH_START_DELAY_MS = 6000;

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
    if (idx >= storefrontImports.length) return;
    const imp = storefrontImports[idx++];
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
