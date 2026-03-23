/**
 * Hover-based and idle-time route prefetching.
 *
 * - On hover/focus of internal links: triggers lazy import of the route chunk
 * - On idle: prefetches critical storefront routes in the background
 *
 * This gives Shopify-style instant navigation after first interaction.
 */

/** Track which paths have already been prefetched */
const prefetched = new Set<string>();

/** Map of route patterns to their dynamic import functions */
const routeImports: Record<string, () => Promise<unknown>> = {
  "/product/": () => import("@/pages/ProductDetail"),
  "/category/": () => import("@/pages/CategoryDetail"),
  "/cart": () => import("@/pages/CartPage"),
  "/checkout": () => import("@/pages/CheckoutPage"),
  "/best-sellers": () => import("@/pages/StorefrontBestSellers"),
  "/contact": () => import("@/pages/StorefrontContact"),
  "/wishlist": () => import("@/pages/WishlistPage"),
  "/account": () => import("@/pages/StorefrontAccount"),
};

/**
 * Prefetch the JS chunk for a given path.
 * No-ops if already prefetched.
 */
function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;

  for (const [pattern, importFn] of Object.entries(routeImports)) {
    if (path.includes(pattern) || path.endsWith(pattern)) {
      prefetched.add(path);
      importFn().catch(() => {
        // Network error — allow retry later
        prefetched.delete(path);
      });
      return;
    }
  }
}

/**
 * Schedule idle-time prefetch of critical routes.
 * Call once after initial render.
 */
export function prefetchCriticalRoutes(): void {
  const criticalPaths = ["/product/", "/cart", "/checkout"];
  const schedule = "requestIdleCallback" in window
    ? (fn: () => void) => (window as any).requestIdleCallback(fn, { timeout: 5000 })
    : (fn: () => void) => setTimeout(fn, 3000);

  criticalPaths.forEach((path, i) => {
    schedule(() => prefetchRoute(path));
  });
}

/**
 * Set up hover/focus-based prefetching on all internal links.
 * Uses event delegation on document.body for efficiency.
 */
export function setupHoverPrefetch(): void {
  let observer: IntersectionObserver | null = null;

  // Hover-based prefetch with 100ms delay to avoid false triggers
  const hoverTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

  function handlePointerEnter(e: Event) {
    const link = (e.target as Element)?.closest?.("a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("//") || href.startsWith("#")) return;

    const timer = setTimeout(() => prefetchRoute(href), 65);
    hoverTimers.set(link, timer);
  }

  function handlePointerLeave(e: Event) {
    const link = (e.target as Element)?.closest?.("a[href]");
    if (!link) return;
    const timer = hoverTimers.get(link);
    if (timer) {
      clearTimeout(timer);
      hoverTimers.delete(link);
    }
  }

  document.body.addEventListener("pointerenter", handlePointerEnter, true);
  document.body.addEventListener("pointerleave", handlePointerLeave, true);
  document.body.addEventListener("focusin", handlePointerEnter, true);

  return;
}
