const ROOT_DOMAIN = "storivo.in";

/**
 * Extract the store slug from the current hostname's subdomain.
 * Returns null for root domain, www, localhost, and Lovable preview URLs.
 */
export function getSubdomainSlug(): string | null {
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
    // Exact root domain match (no subdomain)
    if (hostname === ROOT_DOMAIN) return null;
    return null;
  }

  // Extract the subdomain part
  const subdomain = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);

  // Ignore www or empty
  if (!subdomain || subdomain === "www") {
    return null;
  }

  // Could be nested subdomain like "a.b" — only allow single-level
  if (subdomain.includes(".")) {
    return null;
  }

  return subdomain;
}

export { ROOT_DOMAIN };
