/**
 * Triggers revalidation of pre-rendered storefront pages.
 *
 * Call this after any mutation that changes storefront-visible data:
 * - Product create/update/delete
 * - Store settings change
 * - Category changes
 *
 * Fires asynchronously — does not block the UI.
 */

import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";

/**
 * Revalidate all pages for a store.
 */
export async function revalidateStore(slug: string): Promise<void> {
  if (!PROJECT_ID || !slug) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(
      `https://${PROJECT_ID}.supabase.co/functions/v1/revalidate?slug=${encodeURIComponent(slug)}`,
      {
        method: "GET",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
  } catch {
    // Fire-and-forget — don't block UI on revalidation failure
  }
}

/**
 * Revalidate a specific page for a store.
 */
export async function revalidatePath(slug: string, path: string): Promise<void> {
  if (!PROJECT_ID || !slug) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(
      `https://${PROJECT_ID}.supabase.co/functions/v1/revalidate?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(path)}`,
      {
        method: "GET",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
  } catch {
    // Fire-and-forget
  }
}
