const PREWARM_COOLDOWN_MS = 10_000;
const inflightPrewarms = new Map<string, Promise<void>>();
const recentPrewarms = new Map<string, number>();

/**
 * Trigger cache pre-warm for a store via the prewarm-store edge function.
 * Called after: store creation, custom domain connect, product changes.
 * This ensures the first real user gets an instant cache HIT from the Cloudflare Worker.
 *
 * Awaitable — callers can choose to await (e.g. store creation) or fire-and-forget.
 */
export async function prewarmStore(slug: string, domain?: string | null): Promise<void> {
  const key = `${slug}:${domain ?? ""}`;
  const now = Date.now();

  const recentTs = recentPrewarms.get(key);
  if (recentTs && now - recentTs < PREWARM_COOLDOWN_MS) return;

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
