import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export const PDP_POOL_PAGE_SIZE = 12;

const FIELDS =
  "id,name,slug,price,sale_price,image_url,category,stock_quantity,is_best_selling,has_variants,video_url,video_poster_url";

type Pool = "same" | "best" | "other";

interface Args {
  storeId: string;
  currentProductId: string;
  currentCategory: string | null;
}

/** Store categories, ordered the way the merchant arranged them. */
function useStoreCategories(storeId: string) {
  return useQuery({
    queryKey: ["pdp-store-categories", storeId],
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id,name,slug,display_order")
        .eq("store_id", storeId)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; name: string; slug: string; display_order: number | null }[];
    },
  });
}

function usePool(pool: Pool, args: Args, category: string | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["pdp-pool", pool, args.storeId, category ?? "-", args.currentProductId],
    enabled: enabled && !!args.storeId && !!args.currentProductId,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    getNextPageParam: (last: any[], _all, lastParam: number) =>
      last.length === PDP_POOL_PAGE_SIZE ? lastParam + 1 : undefined,
    queryFn: async ({ pageParam }) => {
      const { supabase } = await import("@/integrations/supabase/client");
      const offset = (pageParam as number) * PDP_POOL_PAGE_SIZE;
      let q = (supabase as any)
        .from("products")
        .select(FIELDS)
        .eq("store_id", args.storeId)
        .eq("is_active", true)
        .neq("id", args.currentProductId);

      if (pool === "best") q = q.eq("is_best_selling", true);
      else if (category) q = q.eq("category", category);

      const { data, error } = await q
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + PDP_POOL_PAGE_SIZE - 1);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function usePdpCarouselPools({ storeId, currentProductId, currentCategory }: Args) {
  const { data: categories } = useStoreCategories(storeId);

  // "Other category" = the next category after the current one (wrapping).
  const otherCategory = useMemo(() => {
    const list = (categories || []).map((c) => c.name).filter(Boolean);
    if (list.length === 0) return null;
    if (!currentCategory) return list[0] ?? null;
    const idx = list.findIndex((n) => n?.toLowerCase() === currentCategory.toLowerCase());
    if (idx === -1) return list.find((n) => n?.toLowerCase() !== currentCategory.toLowerCase()) ?? null;
    const next = list[(idx + 1) % list.length];
    return next && next.toLowerCase() !== currentCategory.toLowerCase() ? next : null;
  }, [categories, currentCategory]);

  const same = usePool("same", { storeId, currentProductId, currentCategory }, currentCategory, !!currentCategory);
  const best = usePool("best", { storeId, currentProductId, currentCategory }, null, true);
  const other = usePool("other", { storeId, currentProductId, currentCategory }, otherCategory, !!otherCategory);

  const flat = (q: any) => (q.data?.pages ?? []).flat() as any[];

  // Dedupe in priority order: same → best → other.
  const { sameItems, bestItems, otherItems } = useMemo(() => {
    const seen = new Set<string>([currentProductId]);
    const take = (rows: any[]) => {
      const out: any[] = [];
      for (const p of rows) {
        if (!p?.id || seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      }
      return out;
    };
    return {
      sameItems: take(flat(same)),
      bestItems: take(flat(best)),
      otherItems: take(flat(other)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [same.data, best.data, other.data, currentProductId]);

  return {
    otherCategory,
    same: { items: sameItems, query: same },
    best: { items: bestItems, query: best },
    other: { items: otherItems, query: other },
  };
}
