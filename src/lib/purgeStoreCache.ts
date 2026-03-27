/**
 * Purge all edge caches for a store (shell HTML + products).
 * Calls the Worker's /api/purge-shell and /api/purge-products endpoints
 * on both subdomain and custom domain (if any).
 *
 * Fire-and-forget — never blocks UI. Returns true if at least one purge succeeded.
 */
export async function purgeStoreCache(
  slug: string,
  customDomain?: string | null
): Promise<boolean> {
  const domains: string[] = [`https://${slug}.storivo.in`];
  if (customDomain) {
    domains.push(`https://${customDomain}`);
  }

  const requests = domains.flatMap((base) => [
    fetch(`${base}/api/purge-shell?slug=${encodeURIComponent(slug)}`, { method: "POST" }).catch(() => null),
    fetch(`${base}/api/purge-products`, { method: "POST" }).catch(() => null),
  ]);

  try {
    const results = await Promise.allSettled(requests);
    return results.some(
      (r) => r.status === "fulfilled" && r.value && (r.value as Response).ok
    );
  } catch {
    return false;
  }
}
