/**
 * Prefetch storefront page chunks during idle time.
 * Called once when the storefront layout mounts.
 * 
 * Delay: 5s after mount to avoid competing with critical render path.
 * Only prefetch high-probability navigation targets (product, category, shop).
 * Heavy pages (Checkout, Wishlist) are loaded on-demand.
 */
const storefrontImports = [
  () => import("@/pages/ProductDetail"),
  () => import("@/pages/CategoryDetail"),
  () => import("@/pages/StorefrontShop"),
  () => import("@/pages/CartPage"),
];

let prefetched = false;

export function prefetchStorefrontRoutes() {
  if (prefetched) return;
  prefetched = true;

  const schedule = typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 200);

  let idx = 0;
  function loadNext() {
    if (idx >= storefrontImports.length) return;
    const imp = storefrontImports[idx++];
    imp().catch(() => {});
    schedule(loadNext);
  }

  // Start well after first paint to avoid network contention
  setTimeout(() => schedule(loadNext), 5000);
}
