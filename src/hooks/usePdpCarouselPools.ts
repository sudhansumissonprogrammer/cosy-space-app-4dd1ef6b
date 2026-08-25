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

/**
 * Perf: page 0 of ALL THREE pools + the store category list arrive in a single
 * `get_pdp_carousel_pools` RPC (was 4 separate REST round-trips). Pages 2+ of
 * a pool still use the paginated product query below, so "load more" inside a
 * carousel behaves exactly as before.
 */
function useCarouselSeed(args: Args) {
  return useQuery({
    queryKey: ["pdp-pools-seed", args.storeId, args.currentProductId, args.currentCategory ?? "-"],
    enabled: !!args.storeId && !!args.currentProductId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase as any).rpc("get_pdp_carousel_pools", {
        _store_id: args.storeId,
        _product_id: args.currentProductId,
        _category: args.currentCategory,
        _limit: PDP_POOL_PAGE_SIZE,
      });
      if (error) throw error;
      const payload = (Array.isArray(data) ? data[0] : data) || {};
      return {
        categories: (payload.categories || []) as { id: string; name: string; slug: string; display_order: number | null }[],
        otherCategory: (payload.other_category ?? null) as string | null,
        same: (payload.same || []) as any[],
        best: (payload.best || []) as any[],
        other: (payload.other || []) as any[],
      };
    },
  });
}

function usePool(
  pool: Pool,
  args: Args,
  category: string | null,
  enabled: boolean,
  seed: any[] | undefined,
) {
  return useInfiniteQuery({
    queryKey: ["pdp-pool", pool, args.storeId, category ?? "-", args.currentProductId],
    enabled: enabled && !!args.storeId && !!args.currentProductId && !!seed,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    // Seed page 0 from the combined RPC so no extra request fires for it.
    initialData: seed ? { pages: [seed], pageParams: [0] } : undefined,
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
  const { data: seed } = useCarouselSeed({ storeId, currentProductId, currentCategory });

  const otherCategory = seed?.otherCategory ?? null;

  const same = usePool("same", { storeId, currentProductId, currentCategory }, currentCategory, !!currentCategory, seed?.same);
  const best = usePool("best", { storeId, currentProductId, currentCategory }, null, true, seed?.best);
  const other = usePool("other", { storeId, currentProductId, currentCategory }, otherCategory, !!otherCategory, seed?.other);

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
