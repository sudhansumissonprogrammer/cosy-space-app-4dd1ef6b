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

export function prefetchStorefrontRoutes() {
  if (prefetched) return;
  prefetched = true;

  const schedule = typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 100);

  let idx = 0;
  function loadNext() {
    if (idx >= storefrontImports.length) return;
    const imp = storefrontImports[idx++];
    imp().catch(() => {});
    schedule(loadNext);
  }

  // Start after page is interactive
  setTimeout(() => schedule(loadNext), 1500);
}
