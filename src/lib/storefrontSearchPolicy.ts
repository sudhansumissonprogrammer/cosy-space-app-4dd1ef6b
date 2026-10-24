const UTILITY_ROUTES = new Set(["cart", "checkout", "account", "search", "track-order", "wishlist", "auth", "order-confirmation"]);

/** Strip only the current store's preview prefix; never classify another tenant. */
export function storefrontUtilityRoute(pathname: string, storeSlug: string): string | null {
  const prefix = `/store/${storeSlug}`;
  const path = pathname === prefix || pathname.startsWith(`${prefix}/`)
    ? pathname.slice(prefix.length)
    : pathname;
  const route = path.split("/").filter(Boolean)[0] || "";
  return UTILITY_ROUTES.has(route) ? route : null;
}