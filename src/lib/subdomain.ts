const ROOT_DOMAIN = "storivo.in";

declare global {
  interface Window {
    __STORE_SLUG__?: string;
  }
}

/**
 * Extract the store slug using multiple strategies:
 * 1. window.__STORE_SLUG__ (injected by Cloudflare worker for custom domains)
 * 2. ?store= query param fallback
 * 3. Subdomain extraction from hostname
 * Returns null for root domain, www, localhost, and Lovable preview URLs.
 */
export function getSubdomainSlug(): string | null {
  // 1. Try from header/worker-injected global (custom domain)
  if (window.__STORE_SLUG__) {
    return window.__STORE_SLUG__;
  }

  // 2. Try query param fallback
  const params = new URLSearchParams(window.location.search);
  const slugFromQuery = params.get("store");
  if (slugFromQuery) {
    return slugFromQuery;
  }

  // 3. Fall back to subdomain extraction
  const hostname = window.location.hostname;

  // Ignore localhost and IP addresses
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  // Ignore Lovable preview/published URLs (*.lovable.app)
  if (hostname.endsWith(".lovable.app")) {
    return null;
  }

  // Must end with our root domain
  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    if (hostname === ROOT_DOMAIN) return null;
    return null;
  }

  // Extract the subdomain part
  const subdomain = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);

  // Ignore www or empty
  if (!subdomain || subdomain === "www") {
    return null;
  }

  // Only allow single-level subdomains
  if (subdomain.includes(".")) {
    return null;
  }

  return subdomain;
}

/**
 * Build a storefront-relative path.
 * In subdomain mode: returns "/path" directly.
 * In path mode: returns "/store/{slug}/path".
 */
export function storefrontPath(slug: string, path: string = ""): string {
  const subdomain = getSubdomainSlug();
  if (subdomain) {
    return path ? `/${path}` : "/";
  }
  return path ? `/store/${slug}/${path}` : `/store/${slug}`;
}

export { ROOT_DOMAIN };
