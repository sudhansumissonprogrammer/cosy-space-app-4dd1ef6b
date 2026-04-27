// v8.1.0 cost-cut: cooldown bumped 90s → 5min. Each prewarm fans out to 2-3
// Worker requests + KV writes. Storefront KV/Cache TTLs are now 24h, so
// merchants editing in bursts no longer need second-by-second warm refreshes —
// the trailing-edge debounce still ensures the LAST save in a burst propagates.
const PREWARM_COOLDOWN_MS = 300_000;
const TRAILING_DELAY_MS = 1_500; // batch trailing-edge: collapse multi-saves within 1.5s

const inflightPrewarms = new Map<string, Promise<void>>();
const recentPrewarms = new Map<string, number>();
const trailingTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface PrewarmOptions {
  /**
   * If true, this prewarm is for a "trivial" save (booleans, display_order,
   * SKU, internal flags). It will be SKIPPED if a recent prewarm already ran.
   * Use for changes shoppers can't see. Default: false.
   */
  trivial?: boolean;
  /**
   * If true, this save is for hidden/inactive content (is_active=false,
   * draft product, suspended store). Skipped entirely. Default: false.
   */
  hidden?: boolean;
}

/**
 * Trigger cache pre-warm for a store via the prewarm-store edge function.
 * Called after: store creation, custom domain connect, product/theme changes.
 *
 * Coalescing rules:
 *  1. If `hidden=true` → skip (nothing on storefront to refresh).
 *  2. If `trivial=true` AND a recent warm ran within cooldown → skip.
 *  3. Cooldown window: only 1 warm per store per 90s.
 *  4. Trailing-edge debounce: bursts within 1.5s collapse into one final warm
 *     (so the LAST save in the burst still triggers a warm, not just the first).
 *  5. Inflight de-dup: concurrent calls reuse the same promise.
 */
export async function prewarmStore(
  slug: string,
  domain?: string | null,
  options: PrewarmOptions = {}
): Promise<void> {
  if (options.hidden) return;

  const key = `${slug}:${domain ?? ""}`;
  const now = Date.now();

  const recentTs = recentPrewarms.get(key);
  const withinCooldown = recentTs && now - recentTs < PREWARM_COOLDOWN_MS;

  // Trivial saves never warm if a recent warm already happened.
  if (options.trivial && withinCooldown) return;

  // For non-trivial saves inside cooldown, schedule a trailing-edge warm so
  // the LAST change in a burst still propagates — but coalesced into one call.
  if (withinCooldown) {
    if (trailingTimers.has(key)) return; // already scheduled
    const timer = setTimeout(() => {
      trailingTimers.delete(key);
      // Reset cooldown so the trailing warm runs.
      recentPrewarms.delete(key);
      void prewarmStore(slug, domain);
    }, TRAILING_DELAY_MS);
    trailingTimers.set(key, timer);
    return;
  }

  const inflight = inflightPrewarms.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const body: Record<string, string> = { slug };
      if (domain) body.domain = domain;

      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.functions.invoke("prewarm-store", { body });
    } catch {
      // Silent — prewarm is best-effort
    } finally {
      recentPrewarms.set(key, Date.now());
      inflightPrewarms.delete(key);
    }
  })();

  inflightPrewarms.set(key, task);
  return task;
}
