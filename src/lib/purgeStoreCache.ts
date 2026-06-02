/**
 * Purge edge caches for a store.
 *
 * v2 (KV-cost optimization, 2026-05):
 *  - Hit both the subdomain and custom-domain endpoints when a custom domain
 *    exists. Workers KV is global, but Cloudflare Cache API is per-colo, so
 *    the custom-domain colo must receive its own purge for instant tracking.
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
  /** Bypass the local dashboard cooldown for setup flows that must be live immediately. */
  force?: boolean;
}

const inflightPurges = new Map<string, Promise<boolean>>();
const recentPurges = new Map<string, { ts: number; result: boolean }>();
const trailingTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function _doPurge(slug: string, customDomain: string | null | undefined, opts: PurgeOptions): Promise<boolean> {
  const cleanDomain = customDomain?.replace(/^www\./, "").toLowerCase().trim();
  const bases = [`https://${slug}.shopbanao.in`, ...(cleanDomain ? [`https://${cleanDomain}`] : [])];
  const params = new URLSearchParams({ slug });
  if (cleanDomain) params.set("domain", cleanDomain);

  const calls: Promise<Response | null>[] = bases.map((base) =>
    fetch(`${base}/api/purge-store?${params.toString()}`, { method: "POST", cache: "no-store" }).catch(() => null),
  );
  if (opts.shell) {
    calls.push(...bases.map((base) =>
      fetch(`${base}/api/purge-shell?${params.toString()}`, { method: "POST", cache: "no-store" }).catch(() => null),
    ));
  }

  try {
    const results = await Promise.allSettled(calls);
    return results.every((r) => r.status === "fulfilled" && !!r.value?.ok);
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
  const withinCooldown = !opts.force && recent && now - recent.ts < PURGE_COOLDOWN_MS;

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

  const task = _doPurge(slug, customDomain, opts);
  inflightPurges.set(key, task);

  try {
    const result = await task;
    recentPurges.set(key, { ts: Date.now(), result });
    return result;
  } finally {
    inflightPurges.delete(key);
  }
}
