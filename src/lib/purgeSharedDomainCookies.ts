/**
 * Anti-ban guard: when a shopper visits a merchant's **custom domain**
 * (e.g. serdiyajewellers.shop), make sure no stale Meta / analytics cookies
 * scoped to the shared platform domain `.shopbanao.in` are still present.
 *
 * Why this matters
 * ----------------
 * Every merchant store also lives at `<slug>.shopbanao.in`. A single browser
 * that visits two unrelated merchants' subdomains carries the SAME
 * `_fbp` / `_fbc` cookie (because they're scoped to `.shopbanao.in`). When
 * that same browser later visits a custom domain, the old shopbanao cookie
 * is still sent on every Pixel/CAPI event, so Meta correlates two unrelated
 * stores as one site → shared reputation poisoning across the whole platform.
 *
 * The fix: on custom-domain hosts only, delete any cookie whose scope is the
 * shared platform domain. The browser will mint a fresh `_fbp` scoped to the
 * custom domain on the next Pixel call — isolated per merchant.
 *
 * Safe by design:
 *   • Only runs on custom-domain hosts (never on *.shopbanao.in itself).
 *   • Only touches cookies on the wrong domain — the merchant's own cookies
 *     scoped to their custom domain are untouched.
 *   • Runs at most once per tab session.
 */

const RAN_FLAG = "__SF_SHARED_COOKIE_PURGED__";
const PLATFORM_SUFFIX = ".shopbanao.in";

const COOKIES_TO_PURGE = [
  "_fbp",
  "_fbc",
  "_ga",
  "_gid",
  "_gcl_au",
  "sf_vid",
];

export function purgeSharedDomainCookies(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const w = window as any;
  if (w[RAN_FLAG]) return;

  const host = window.location.hostname;
  // Skip only non-production hosts. We DO purge on `.shopbanao.in`
  // subdomains: legacy visits may have left an `_fbp` scoped to the apex
  // `.shopbanao.in`, which is then shared across every merchant subdomain →
  // Meta links all stores into one audience → platform-wide reputation
  // poisoning. Deleting the apex-scoped cookie lets `ensureFbpCookie()`
  // mint a fresh host-only cookie scoped to just this subdomain, isolating
  // each merchant. The apex host itself (`shopbanao.in` / `www.shopbanao.in`)
  // is the marketing site — also safe to purge there.
  if (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".sandbox.lovable.dev")
  ) {
    w[RAN_FLAG] = true;
    return;
  }

  // Delete each known tracking cookie scoped to the platform suffix
  // (and the bare ".shopbanao.in" variant). Browsers only honour a cookie
  // delete when the `domain` attribute matches the cookie's original scope,
  // so we issue both variants.
  const expire = "Thu, 01 Jan 1970 00:00:00 GMT";
  for (const name of COOKIES_TO_PURGE) {
    try {
      document.cookie = `${name}=; expires=${expire}; path=/; domain=${PLATFORM_SUFFIX}`;
      document.cookie = `${name}=; expires=${expire}; path=/; domain=shopbanao.in`;
    } catch {
      /* cookie writes can throw in locked-down contexts — best effort */
    }
  }

  w[RAN_FLAG] = true;
}
