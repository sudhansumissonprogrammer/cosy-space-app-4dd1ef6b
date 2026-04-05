const ROOT_DOMAIN = "shopbanao.in";

declare global {
  interface Window {
    __STORE_SLUG__?: string;
  }
}

const IPV4_REGEX = /^\d+\.\d+\.\d+\.\d+$/;
const PREVIEW_HOST_SUFFIXES = [".lovable.app", ".lovableproject.com"];

export function isLocalHost(hostname: string = window.location.hostname): boolean {
  return hostname === "localhost" || IPV4_REGEX.test(hostname);
}

export function isPreviewHost(hostname: string = window.location.hostname): boolean {
  return PREVIEW_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

export function isRootDomainHost(hostname: string = window.location.hostname): boolean {
  const normalized = hostname.replace(/^www\./, "").toLowerCase();
  return normalized === ROOT_DOMAIN;
}

export function isSubdomainHost(hostname: string = window.location.hostname): boolean {
  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) return false;
  const subdomain = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);
  return !!subdomain && subdomain !== "www" && !subdomain.includes(".");
}

export function isCustomDomainHost(hostname: string = window.location.hostname): boolean {
  return (
    !isLocalHost(hostname) &&
    !isPreviewHost(hostname) &&
    !isRootDomainHost(hostname) &&
    !isSubdomainHost(hostname)
  );
}

/**
 * Extract the store slug using multiple strategies:
 * 1. window.__STORE_SLUG__ (injected by edge worker for custom domains)
 * 2. ?store= query param fallback
 * 3. Subdomain extraction from hostname
 * Returns null for root domain, www, localhost, and preview URLs.
 *
 * Result is cached after first call to avoid repeated URLSearchParams parsing.
 */
let _cachedSlug: string | null | undefined;

export function getSubdomainSlug(): string | null {
  if (_cachedSlug !== undefined) return _cachedSlug;

  if (window.__STORE_SLUG__) {
    _cachedSlug = window.__STORE_SLUG__;
    return _cachedSlug;
  }

  const params = new URLSearchParams(window.location.search);
  const slugFromQuery = params.get("store");
  if (slugFromQuery) {
    _cachedSlug = slugFromQuery;
    return _cachedSlug;
  }

  const hostname = window.location.hostname;

  if (isLocalHost(hostname) || isPreviewHost(hostname) || isRootDomainHost(hostname)) {
    _cachedSlug = null;
    return null;
  }

  if (!isSubdomainHost(hostname)) {
    _cachedSlug = null;
    return null;
  }

  _cachedSlug = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);
  return _cachedSlug;
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
