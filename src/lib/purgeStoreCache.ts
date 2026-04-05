/**
 * Purge all edge caches for a store.
 *
 * Uses the per-store purge endpoint (/api/purge-store) which invalidates
 * only that store's caches (products + storefront data + early HTML)
 * without touching the global SPA shell.
 *
 * Also fires legacy purge endpoints for backwards compatibility.
 *
 * Fire-and-forget — never blocks UI. Returns true if at least one purge succeeded.
 */
export async function purgeStoreCache(
  slug: string,
  customDomain?: string | null
): Promise<boolean> {
  const domains: string[] = [`https://${slug}.shopbanao.in`];
  if (customDomain) {
    domains.push(`https://${customDomain}`);
  }

  const requests = domains.flatMap((base) => [
    // Per-store purge (new v3.4 — purges store caches without touching global shell)
    fetch(`${base}/api/purge-store?slug=${encodeURIComponent(slug)}`, { method: "POST" }).catch(() => null),
    // Legacy purge endpoints (backwards compatibility)
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
