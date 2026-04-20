/**
 * Tracks recently viewed products in localStorage (per store).
 * Cap at 12 items, most-recent first, deduped by product id.
 */
import { useCallback, useEffect, useState } from "react";

const KEY_PREFIX = "v19_recent_";
const MAX = 12;

export interface RecentItem {
  id: string;
  name: string;
  slug?: string | null;
  image_url?: string | null;
  price: number;
  sale_price?: number | null;
  currency?: string;
}

function read(storeId: string): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + storeId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useRecentlyViewed(storeId: string | undefined) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    if (!storeId) return;
    setItems(read(storeId));
  }, [storeId]);

  const track = useCallback(
    (item: RecentItem) => {
      if (!storeId || !item?.id) return;
      const current = read(storeId).filter((i) => i.id !== item.id);
      const next = [item, ...current].slice(0, MAX);
      try {
        localStorage.setItem(KEY_PREFIX + storeId, JSON.stringify(next));
      } catch {
        /* quota exceeded */
      }
      setItems(next);
    },
    [storeId]
  );

  return { items, track };
}
