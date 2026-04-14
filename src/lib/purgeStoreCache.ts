/**
 * Purge all edge caches for a store.
 *
 * Uses the per-store purge endpoint (/api/purge-store) which invalidates
 * only that store's caches (products + storefront data + early HTML).
 *
 * v2: Removed legacy /api/purge-shell and /api/purge-products calls —
 * /api/purge-store already handles everything via version bump.
 * This reduces Worker requests from 6 → 2 (or 3 → 1 without custom domain).
 */
export async function purgeStoreCache(
  slug: string,
  customDomain?: string | null
): Promise<boolean> {
  const domains: string[] = [`https://${slug}.shopbanao.in`];
  if (customDomain) {
    domains.push(`https://${customDomain}`);
  }

  // Single purge-store call per domain — handles products + shell + storefront
  const requests = domains.map((base) =>
    fetch(`${base}/api/purge-store?slug=${encodeURIComponent(slug)}`, { method: "POST" }).catch(() => null)
  );

  try {
    const results = await Promise.allSettled(requests);
    return results.some(
      (r) => r.status === "fulfilled" && r.value && (r.value as Response).ok
    );
  } catch {
    return false;
  }
}
