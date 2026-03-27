import { supabase } from "@/integrations/supabase/client";

/**
 * Trigger cache pre-warm for a store via the prewarm-store edge function.
 * Called after: store creation, custom domain connect, product changes.
 * This ensures the first real user gets an instant cache HIT from the Cloudflare Worker.
 *
 * Fire-and-forget — never blocks UI.
 */
export async function prewarmStore(slug: string, domain?: string | null): Promise<void> {
  try {
    const body: Record<string, string> = { slug };
    if (domain) body.domain = domain;

    // Call edge function (fire-and-forget)
    supabase.functions.invoke("prewarm-store", {
      body,
    }).catch(() => {
      // Silent — prewarm is best-effort
    });
  } catch {
    // Silent — never block UI for cache warming
  }
}
