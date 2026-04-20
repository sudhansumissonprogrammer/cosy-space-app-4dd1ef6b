/**
 * Purge all edge caches for a store.
 *
 * Uses both per-store purge endpoints:
 * - /api/purge-shell clears the cached SPA shell + prebuilt head
 * - /api/purge-store clears store data, product caches, and domain mappings
 *
 * This prevents mixed old/new asset references on custom domains after publish.
 */

const PURGE_COOLDOWN_MS = 5_000;
const inflightPurges = new Map<string, Promise<boolean>>();
const recentPurges = new Map<string, { ts: number; result: boolean }>();

export async function purgeStoreCache(
  slug: string,
  customDomain?: string | null
): Promise<boolean> {
  const key = `${slug}:${customDomain ?? ""}`;
  const recent = recentPurges.get(key);
  if (recent && Date.now() - recent.ts < PURGE_COOLDOWN_MS) {
    return recent.result;
  }

  const inflight = inflightPurges.get(key);
  if (inflight) return inflight;

  const domains: string[] = [`https://${slug}.shopbanao.in`];
  if (customDomain) {
    domains.push(`https://${customDomain}`);
  }

  const requests = domains.map(async (base) => {
    const [shellRes, storeRes] = await Promise.allSettled([
      fetch(`${base}/api/purge-shell?slug=${encodeURIComponent(slug)}`, { method: "POST" }).catch(() => null),
      fetch(`${base}/api/purge-store?slug=${encodeURIComponent(slug)}`, { method: "POST" }).catch(() => null),
    ]);

    const shellOk = shellRes.status === "fulfilled" && !!shellRes.value?.ok;
    const storeOk = storeRes.status === "fulfilled" && !!storeRes.value?.ok;

    return shellOk || storeOk;
  });

  const task = (async () => {
    try {
      const results = await Promise.allSettled(requests);
      return results.some((r) => r.status === "fulfilled" && r.value);
    } catch {
      return false;
    }
  })();

  inflightPurges.set(key, task);

  try {
    const result = await task;
    recentPurges.set(key, { ts: Date.now(), result });
    return result;
  } finally {
    inflightPurges.delete(key);
  }
}
