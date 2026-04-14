import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Worker /api/products page size is 20 — match it so pagination aligns
 * with edge cache keys.
 */
const PAGE_SIZE = 20;

const PRODUCT_COLUMNS =
  "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

function isProductionHost(): boolean {
  const h = window.location.hostname;
  const isLocal = h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h);
  const isPreview = h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com");
  return !isLocal && !isPreview;
}

interface FetchOpts {
  storeId: string;
  category?: string;
  page: number;
  sort?: string;
}

async function fetchPage({ storeId, category, page, sort }: FetchOpts): Promise<any[]> {
  if (isProductionHost()) {
    // ── Production: use Worker /api/products (cached, KV-backed) ──
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (page > 0) params.set("page", String(page));
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    const url = `${window.location.origin}/api/products${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Worker API error: ${res.status}`);
    return await res.json();
  }

  // ── Preview / localhost: direct Supabase ──
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("store_id", storeId)
    .eq("is_active", true);

  if (category) q = q.eq("category", category);

  q = q
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Shared infinite-scroll hook for Shop All & Category pages.
 * Production → Worker /api/products (cache + KV + DB).
 * Preview   → direct Supabase.
 */
export function useInfiniteProducts(opts: {
  storeId: string | undefined;
  category?: string;
  sort?: string;
  queryKeyPrefix: string;
  /** Extra enabled guard — e.g. wait for category name to resolve */
  ready?: boolean;
}) {
  const { storeId, category, sort, queryKeyPrefix, ready = true } = opts;

  return useInfiniteQuery({
    queryKey: [queryKeyPrefix, storeId, category || "__all__", sort || "default", PAGE_SIZE],
    queryFn: async ({ pageParam = 0 }) => {
      const products = await fetchPage({
        storeId: storeId!,
        category,
        page: pageParam,
        sort,
      });
      return { products, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.products.length === PAGE_SIZE ? lastPage.page + 1 : undefined,
    enabled: !!storeId && ready,
    staleTime: 5 * 60 * 1000,
  });
}

export { PAGE_SIZE };
