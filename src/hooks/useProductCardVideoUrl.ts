import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isCardVideoEligible } from "@/lib/cardVideoScheduler";

type PendingLookup = {
  resolve: (url: string | null) => void;
  reject: (error: unknown) => void;
};

const pending = new Map<string, PendingLookup[]>();
let flushScheduled = false;

async function flushVideoLookups() {
  flushScheduled = false;
  const batch = new Map(pending);
  pending.clear();
  const ids = Array.from(batch.keys());
  if (!ids.length) return;

  const { data, error } = await supabase
    .from("products")
    .select("id,video_url")
    .in("id", ids);

  if (error) {
    batch.forEach((lookups) => lookups.forEach(({ reject }) => reject(error)));
    return;
  }

  const urls = new Map((data || []).map((row) => [row.id, row.video_url || null]));
  batch.forEach((lookups, id) => {
    const url = urls.get(id) || null;
    lookups.forEach(({ resolve }) => resolve(url));
  });
}

function lookupVideoUrl(productId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const lookups = pending.get(productId) || [];
    lookups.push({ resolve, reject });
    pending.set(productId, lookups);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flushVideoLookups);
    }
  });
}

/**
 * Production Worker caches can temporarily omit newly-added media fields.
 * When that happens, resolve video metadata for all rendered cards in one
 * batched database request. This runs only for enabled stores on eligible
 * phones and never downloads the video itself.
 */
export function useProductCardVideoUrl(
  productId: string | undefined,
  inlineUrl: string | null | undefined,
  enabled: boolean,
) {
  const shouldLookup = enabled && !inlineUrl && !!productId && isCardVideoEligible();
  const query = useQuery({
    queryKey: ["product-card-video-url", productId],
    queryFn: () => lookupVideoUrl(productId as string),
    enabled: shouldLookup,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  return inlineUrl || query.data || null;
}