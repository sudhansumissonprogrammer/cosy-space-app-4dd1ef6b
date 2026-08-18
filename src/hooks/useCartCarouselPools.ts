import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export const CART_POOL_PAGE_SIZE = 12;

const FIELDS =
  "id,name,slug,price,sale_price,image_url,category,stock_quantity,is_best_selling,has_variants,video_url,video_poster_url";

type Pool = "same" | "best" | "other";

interface Args {
  storeId: string;
  /** Real product ids currently in the cart (bundle:* already filtered out). */
  cartProductIds: string[];
  /** Categories of the products currently in the cart. */
  cartCategories: string[];
  enabled: boolean;
}

/** Store categories in the merchant's own order. */
function useStoreCategories(storeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["cart-store-categories", storeId],
    enabled: enabled && !!storeId,
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
      return (data || []) as { id: string; name: string; slug: string }[];
    },
  });
}

function usePool(pool: Pool, storeId: string, categories: string[], enabled: boolean) {
  const catKey = categories.join("|") || "-";
  return useInfiniteQuery({
    queryKey: ["cart-pool", pool, storeId, catKey],
    enabled: enabled && !!storeId,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    getNextPageParam: (last: any[], _all, lastParam: number) =>
      last.length === CART_POOL_PAGE_SIZE ? lastParam + 1 : undefined,
    queryFn: async ({ pageParam }) => {
      const { supabase } = await import("@/integrations/supabase/client");
      const offset = (pageParam as number) * CART_POOL_PAGE_SIZE;
      let q = (supabase as any)
        .from("products")
        .select(FIELDS)
        .eq("store_id", storeId)
        .eq("is_active", true);

      if (pool === "best") q = q.eq("is_best_selling", true);
      else if (categories.length === 1) q = q.eq("category", categories[0]);
      else if (categories.length > 1) q = q.in("category", categories);

      const { data, error } = await q
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + CART_POOL_PAGE_SIZE - 1);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

/**
 * Three deduped product pools for the side cart, mirroring the PDP engine:
 *  1. same category as the products in the cart
 *  2. best sellers
 *  3. another category (next in the merchant's order)
 *
 * Every query is gated on `enabled` (cart drawer open) so storefront cold
 * loads issue zero extra requests.
 */
export function useCartCarouselPools({ storeId, cartProductIds, cartCategories, enabled }: Args) {
  const { data: categories } = useStoreCategories(storeId, enabled);

  const otherCategory = useMemo(() => {
    const list = (categories || []).map((c) => c.name).filter(Boolean);
    if (list.length === 0) return null;
    const lower = cartCategories.map((c) => c.toLowerCase());
    if (lower.length === 0) return list[0] ?? null;
    const idx = list.findIndex((n) => lower.includes(n.toLowerCase()));
    if (idx === -1) return list.find((n) => !lower.includes(n.toLowerCase())) ?? null;
    for (let i = 1; i <= list.length; i++) {
      const next = list[(idx + i) % list.length];
      if (next && !lower.includes(next.toLowerCase())) return next;
    }
    return null;
  }, [categories, cartCategories]);

  const same = usePool("same", storeId, cartCategories, enabled && cartCategories.length > 0);
  const best = usePool("best", storeId, [], enabled);
  const other = usePool("other", storeId, otherCategory ? [otherCategory] : [], enabled && !!otherCategory);

  const flat = (q: any) => (q.data?.pages ?? []).flat() as any[];

  const { sameItems, bestItems, otherItems } = useMemo(() => {
    const seen = new Set<string>(cartProductIds);
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
  }, [same.data, best.data, other.data, cartProductIds.join("|")]);

  return {
    otherCategory,
    same: { items: sameItems, query: same },
    best: { items: bestItems, query: best },
    other: { items: otherItems, query: other },
  };
}
