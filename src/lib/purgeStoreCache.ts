/**
 * Purge all edge caches for a store.
 *
 * Uses both per-store purge endpoints:
 * - /api/purge-shell clears the cached SPA shell + prebuilt head
 * - /api/purge-store clears store data, product caches, and domain mappings
 *
 * Coalescing (mirrors prewarmStore.ts to keep behaviour symmetric):
 *  1. Cooldown window: only 1 purge per store per 90s (was 5s — too tight for
 *     theme editor / category toggles where merchants click rapidly).
 *  2. Trailing-edge debounce: bursts within 1.5s collapse into ONE final
 *     purge so the LAST change in a burst still propagates.
 *  3. Inflight de-dup: concurrent calls reuse the same promise.
 *
 * IMPORTANT: We MUST hit both subdomain AND custom domain. Worker KV keys are
 * shared by slug, but the edge Cache API keys are per-hostname
 * (getEarlyCacheKey(hostname), _buildProductsCacheKey(hostname,...)). Skipping
 * either hostname leaves stale HTML in that hostname's edge cache.
 */

const PURGE_COOLDOWN_MS = 90_000;
const TRAILING_DELAY_MS = 1_500;

const inflightPurges = new Map<string, Promise<boolean>>();
const recentPurges = new Map<string, { ts: number; result: boolean }>();
const trailingTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function _doPurge(slug: string, customDomain?: string | null): Promise<boolean> {
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

  try {
    const results = await Promise.allSettled(requests);
    return results.some((r) => r.status === "fulfilled" && r.value);
  } catch {
    return false;
  }
}

export async function purgeStoreCache(
  slug: string,
  customDomain?: string | null
): Promise<boolean> {
  const key = `${slug}:${customDomain ?? ""}`;
  const now = Date.now();

  const recent = recentPurges.get(key);
  const withinCooldown = recent && now - recent.ts < PURGE_COOLDOWN_MS;

  // Inside cooldown: schedule a trailing-edge purge so the LAST change in a
  // burst still propagates (e.g. merchant toggles 5 categories in 10s →
  // 1 final purge instead of 5).
  if (withinCooldown) {
    if (trailingTimers.has(key)) return recent!.result;
    const timer = setTimeout(() => {
      trailingTimers.delete(key);
      recentPurges.delete(key); // reset cooldown so trailing purge runs
      void purgeStoreCache(slug, customDomain);
    }, TRAILING_DELAY_MS);
    trailingTimers.set(key, timer);
    return recent!.result;
  }

  const inflight = inflightPurges.get(key);
  if (inflight) return inflight;

  const task = _doPurge(slug, customDomain);
  inflightPurges.set(key, task);

  try {
    const result = await task;
    recentPurges.set(key, { ts: Date.now(), result });
    return result;
  } finally {
    inflightPurges.delete(key);
  }
}
