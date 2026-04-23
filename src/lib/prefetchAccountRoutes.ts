/**
 * Prefetch storefront account-related page chunks during idle time
 * after a customer logs in. Mirrors prefetchDashboardRoutes pattern.
 *
 * Triggered from StorefrontShell when a user session is detected so
 * navigating to /account, /wishlist, /cart, /checkout feels instant.
 */
const accountImports = [
  () => import("@/pages/StorefrontAccount"),
  () => import("@/pages/WishlistPage"),
  () => import("@/pages/CartPage"),
  () => import("@/pages/CheckoutPage"),
  () => import("@/pages/OrderTrackingPage"),
];

let prefetched = false;

export function prefetchAccountRoutes() {
  if (prefetched) return;
  prefetched = true;

  // Respect Save-Data and slow connections
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const conn = nav.connection;
  if (conn?.saveData) return;
  if (conn?.effectiveType && /(?:^|-)2g/.test(conn.effectiveType)) return;

  const schedule =
    typeof requestIdleCallback === "function"
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 2000 })
      : (cb: () => void) => setTimeout(cb, 200);

  let idx = 0;
  function loadNext() {
    if (idx >= accountImports.length) return;
    const imp = accountImports[idx++];
    imp().catch(() => {});
    schedule(loadNext);
  }

  // Wait a moment so we don't compete with critical content rendering
  setTimeout(() => schedule(loadNext), 1200);
}
