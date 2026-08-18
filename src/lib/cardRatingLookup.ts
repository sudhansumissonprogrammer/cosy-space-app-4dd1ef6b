/**
 * Batched product-rating lookup for grid cards.
 *
 * Grid cards want a genuine "★ 4.7 (128)" badge. Querying per card would mean
 * N requests, so ids are queued for ~120ms and resolved in ONE `product_reviews`
 * query, then aggregated client-side into { rating, count } per product.
 *
 * Products with no real reviews resolve to `null` — the card then falls back to
 * the deterministic rating helper so the layout never shifts.
 */

export type CardRating = { rating: number; count: number } | null;

type Listener = (r: CardRating) => void;

const cache = new Map<string, CardRating>();
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
      .from("product_reviews")
      .select("product_id,rating")
      .in("product_id", ids)
      .eq("is_hidden", false)
      .limit(5000);
    const agg = new Map<string, { sum: number; count: number }>();
    for (const row of data || []) {
      const pid = row.product_id as string;
      const r = Number(row.rating);
      if (!pid || !Number.isFinite(r)) continue;
      const cur = agg.get(pid) || { sum: 0, count: 0 };
      cur.sum += r;
      cur.count += 1;
      agg.set(pid, cur);
    }
    for (const id of ids) {
      const a = agg.get(id);
      const value: CardRating = a && a.count > 0
        ? { rating: Math.round((a.sum / a.count) * 10) / 10, count: a.count }
        : null;
      cache.set(id, value);
      listeners.get(id)?.forEach((fn) => fn(value));
    }
  } catch {
    for (const id of ids) {
      cache.set(id, null);
      listeners.get(id)?.forEach((fn) => fn(null));
    }
  }
}

export function getCachedCardRating(id: string): CardRating | undefined {
  return cache.get(id);
}

/** Subscribe to the review aggregate for a product id. Returns an unsubscribe fn. */
export function requestCardRating(id: string, cb: Listener): () => void {
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
  if (timer === undefined) timer = window.setTimeout(flush, 120);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(id);
  };
}
