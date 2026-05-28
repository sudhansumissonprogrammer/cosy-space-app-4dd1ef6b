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

async function _doPurge(
  slug: string,
  customDomain?: string | null,
  purgeShell: boolean = false,
): Promise<boolean> {
  const domains: string[] = [`https://${slug}.shopbanao.in`];
  if (customDomain) {
    domains.push(`https://${customDomain}`);
  }

  // KV is global → hitting purge-store on every hostname re-deletes the same
  // slug-keyed KV entries (storefront / theme-lite / store-info / warm-lock /
  // html:slug:*). That was the bulk of our daily KV delete ops.
  //
  // New strategy:
  //  - purge-store on subdomain ONLY → wipes all slug-keyed KV once (global).
  //  - per-hostname Cache API mirrors (early cache, html mirror paths,
  //    store-id, domain mapping) are cleared via a lightweight `cacheOnly`
  //    purge-store call on the custom domain. Worker treats unknown params
  //    fine; if `cacheOnly` isn't honored yet it still works (just dup
  //    deletes), so this is forward-safe.
  //  - purge-shell is OPT-IN. Shell KV (spa-shell / prebuilt-head) is a
  //    global build artifact unchanged by product/category/coupon saves, so
  //    we no longer purge it on every dashboard save. Theme / store-settings
  //    callers opt in via `purgeShell = true`.

  const primary = `https://${slug}.shopbanao.in`;
  const ops: Promise<Response | null>[] = [
    fetch(`${primary}/api/purge-store?slug=${encodeURIComponent(slug)}`, {
      method: "POST",
    }).catch(() => null),
  ];

  if (customDomain) {
    ops.push(
      fetch(
        `https://${customDomain}/api/purge-store?slug=${encodeURIComponent(slug)}&cacheOnly=1`,
        { method: "POST" },
      ).catch(() => null),
    );
  }

  if (purgeShell) {
    ops.push(
      fetch(`${primary}/api/purge-shell?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
      }).catch(() => null),
    );
  }

  try {
    const results = await Promise.allSettled(ops);
    return results.some((r) => r.status === "fulfilled" && !!r.value?.ok);
  } catch {
    return false;
  }
}

export async function purgeStoreCache(
  slug: string,
  customDomain?: string | null,
  purgeShell: boolean = false,
): Promise<boolean> {
  const key = `${slug}:${customDomain ?? ""}:${purgeShell ? "1" : "0"}`;
  const now = Date.now();

  const recent = recentPurges.get(key);
  const withinCooldown = recent && now - recent.ts < PURGE_COOLDOWN_MS;

  if (withinCooldown) {
    if (trailingTimers.has(key)) return recent!.result;
    const timer = setTimeout(() => {
      trailingTimers.delete(key);
      recentPurges.delete(key);
      void purgeStoreCache(slug, customDomain, purgeShell);
    }, TRAILING_DELAY_MS);
    trailingTimers.set(key, timer);
    return recent!.result;
  }

  const inflight = inflightPurges.get(key);
  if (inflight) return inflight;

  const task = _doPurge(slug, customDomain, purgeShell);
  inflightPurges.set(key, task);

  try {
    const result = await task;
    recentPurges.set(key, { ts: Date.now(), result });
    return result;
  } finally {
    inflightPurges.delete(key);
  }
}

