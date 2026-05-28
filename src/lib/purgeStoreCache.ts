/**
 * Purge edge caches for a store.
 *
 * v2 (KV-cost optimization, 2026-05):
 *  - Only hit the SUBDOMAIN endpoint. Cloudflare Workers KV is GLOBAL, so a
 *    single `STORE_KV.delete()` clears the key for both subdomain and custom
 *    domain. The worker's `handlePurgeStore`/`handlePurgeShell` already iterate
 *    every domain variant (subdomain + custom domain) for Cache API mirror
 *    deletes, so a single call covers both hostnames' per-colo edge caches.
 *  - `/api/purge-shell` is now opt-in via `{ shell: true }`. Product / category
 *    / coupon / page-content / shipping / tax / payments saves do NOT affect
 *    the SPA shell or prebuilt head, so purging them on every save was pure
 *    waste. Pass `shell: true` only when the change actually mutates the shell
 *    (theme tokens, menu config, slug change, manual "purge cache" button).
 *  - Expected impact: ~75% drop in KV deletes (and matching writes via the
 *    re-warm chain), since the deletion set collapses 4× → 1× per save.
 *
 * Coalescing (unchanged):
 *  1. Cooldown window: only 1 purge per store per 90s.
 *  2. Trailing-edge debounce: bursts within 1.5s collapse into ONE final
 *     purge so the LAST change in a burst still propagates.
 *  3. Inflight de-dup: concurrent calls reuse the same promise.
 */

const PURGE_COOLDOWN_MS = 90_000;
const TRAILING_DELAY_MS = 1_500;

interface PurgeOptions {
  /** Also purge the SPA shell + prebuilt-head KV. Pass true only for changes
   *  that affect the shell (theme, menu, slug). Default: false. */
  shell?: boolean;
}

const inflightPurges = new Map<string, Promise<boolean>>();
const recentPurges = new Map<string, { ts: number; result: boolean }>();
const trailingTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function _doPurge(slug: string, opts: PurgeOptions): Promise<boolean> {
  // Single hostname is enough — KV is global, and the worker handler
  // purges per-hostname Cache API mirrors for every domain variant internally.
  const base = `https://${slug}.shopbanao.in`;

  const calls: Promise<Response | null>[] = [
    fetch(`${base}/api/purge-store?slug=${encodeURIComponent(slug)}`, { method: "POST" }).catch(() => null),
  ];
  if (opts.shell) {
    calls.push(
      fetch(`${base}/api/purge-shell?slug=${encodeURIComponent(slug)}`, { method: "POST" }).catch(() => null),
    );
  }

  try {
    const results = await Promise.allSettled(calls);
    return results.some((r) => r.status === "fulfilled" && !!r.value?.ok);
  } catch {
    return false;
  }
}

export async function purgeStoreCache(
  slug: string,
  customDomain?: string | null,
  opts: PurgeOptions = {}
): Promise<boolean> {
  // customDomain kept in signature for backwards compatibility — no longer
  // used for routing the HTTP call (KV is global). Included in the dedupe key
  // so a slug + domain change still gets its own cooldown bucket.
  const key = `${slug}:${customDomain ?? ""}:${opts.shell ? "shell" : "data"}`;
  const now = Date.now();

  const recent = recentPurges.get(key);
  const withinCooldown = recent && now - recent.ts < PURGE_COOLDOWN_MS;

  if (withinCooldown) {
    if (trailingTimers.has(key)) return recent!.result;
    const timer = setTimeout(() => {
      trailingTimers.delete(key);
      recentPurges.delete(key);
      void purgeStoreCache(slug, customDomain, opts);
    }, TRAILING_DELAY_MS);
    trailingTimers.set(key, timer);
    return recent!.result;
  }

  const inflight = inflightPurges.get(key);
  if (inflight) return inflight;

  const task = _doPurge(slug, opts);
  inflightPurges.set(key, task);

  try {
    const result = await task;
    recentPurges.set(key, { ts: Date.now(), result });
    return result;
  } finally {
    inflightPurges.delete(key);
  }
}
