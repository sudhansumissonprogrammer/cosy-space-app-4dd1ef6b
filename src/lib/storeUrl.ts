import { ROOT_DOMAIN, isCustomDomainHost, isSubdomainHost } from "@/lib/subdomain";

/**
 * Resolve the canonical base URL for a store.
 *
 * Priority:
 *   1. If we're currently ON a custom domain → use window.location.origin
 *   2. If store has a custom_domain configured → use it
 *   3. Fallback → {slug}.shopbanao.in
 *
 * This ensures canonical URLs, JSON-LD, OG tags, and sitemaps
 * always reference the primary domain — matching Shopify behaviour.
 */
export function getStoreBaseUrl(slug: string, customDomain?: string | null): string {
  // If we're already on the custom domain, use it directly
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (isCustomDomainHost(hostname)) {
      return window.location.origin;
    }
  }

  // If store has a custom domain configured, prefer it
  if (customDomain) {
    return `https://${customDomain}`;
  }

  // Fallback to subdomain
  return `https://${slug}.${ROOT_DOMAIN}`;
}
