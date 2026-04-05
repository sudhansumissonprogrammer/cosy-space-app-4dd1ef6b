import { supabase } from "@/integrations/supabase/client";

/**
 * Trigger cache pre-warm for a store via the prewarm-store edge function.
 * Called after: store creation, custom domain connect, product changes.
 * This ensures the first real user gets an instant cache HIT from the Cloudflare Worker.
 *
 * Awaitable — callers can choose to await (e.g. store creation) or fire-and-forget.
 */
export async function prewarmStore(slug: string, domain?: string | null): Promise<void> {
  try {
    const body: Record<string, string> = { slug };
    if (domain) body.domain = domain;

    await supabase.functions.invoke("prewarm-store", { body });
  } catch {
    // Silent — prewarm is best-effort
  }
}
