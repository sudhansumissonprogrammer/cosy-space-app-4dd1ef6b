/**
 * Batched product-video lookup for grid cards.
 *
 * Some product payloads (edge-cached /api/products responses, storefront
 * shell previews, older RPC snapshots) do not carry the `video_url` column
 * at all. The PDP already does a one-off fallback fetch for that case; grid
 * cards need the same, but batched so a 20-card grid makes ONE request.
 *
 * Only IDs whose payload is genuinely missing the column are queried —
 * products that explicitly have `video_url: null` are never fetched.
 */

type Listener = (url: string | null) => void;

const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<Listener>>();
let queue = new Set<string>();
let timer: number | undefined;

async function flush() {
  timer = undefined;
  const ids = Array.from(queue);
  queue = new Set();
  if (ids.length === 0) return;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await (supabase as any)
      .from("products")
      .select("id,video_url")
      .in("id", ids);
    const found = new Map<string, string | null>();
    for (const row of data || []) found.set(row.id, row.video_url ?? null);
    for (const id of ids) {
      const url = found.get(id) ?? null;
      cache.set(id, url);
      listeners.get(id)?.forEach((fn) => fn(url));
    }
  } catch {
    for (const id of ids) {
      cache.set(id, null);
      listeners.get(id)?.forEach((fn) => fn(null));
    }
  }
}

export function getCachedCardVideo(id: string): string | null | undefined {
  return cache.get(id);
}

/** Subscribe to the video url for a product id. Returns an unsubscribe fn. */
export function requestCardVideo(id: string, cb: Listener): () => void {
  if (cache.has(id)) {
    cb(cache.get(id) ?? null);
    return () => {};
  }
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(cb);
  queue.add(id);
  // 300ms window (was 120ms): rows mount ~100-200ms apart on a home feed, so a
  // short window produced 3 separate REST calls per page load. A wider window
  // coalesces them into one without any visible delay — the badge is decorative.
  if (timer === undefined) timer = window.setTimeout(flush, 300);

  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(id);
  };
}
