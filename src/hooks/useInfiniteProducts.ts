import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Worker /api/products page size is 20 — must match PRODUCTS_PAGE_SIZE
 * in docs/cloudflare-worker-current.js so offset arithmetic stays aligned
 * with edge cache keys and inline-products hydration.
 */
const PAGE_SIZE = 20;

const PRODUCT_COLUMNS =
  "id,category,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

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
    // ── v8.47 cost-cut: reuse shell-injected products_preview ──
    // Worker injects window.__STOREFRONT_DATA__.products_preview (first 20
    // products, no filter) into SSR shell for the home page. Reusing it
    // here eliminates an /api/products Worker request on the cold Shop
    // page load (page=0, no filter, no sort). Same idea as the existing
    // __PRODUCTS_INLINE__ branch — that one is 50 products; this one is
    // 20 from the storefront-data shell payload. Whichever exists wins.
    if (page === 0 && !category && !sort) {
      try {
        const sf = (window as any).__STOREFRONT_DATA__;
        const preview = sf && Array.isArray(sf.products_preview) ? sf.products_preview : null;
        if (preview && preview.length > 0) {
          return preview as any[];
        }
        const inline = (window as any).__PRODUCTS_INLINE__;
        if (Array.isArray(inline) && inline.length > 0) {
          return inline as any[];
        }
      } catch { /* ignore */ }
    }


    // ── Production: use Worker /api/products (cached, KV-backed) ──
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (page > 0) params.set("page", String(page));
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    const url = `${window.location.origin}/api/products${qs ? `?${qs}` : ""}`;

    // ── sessionStorage cache: dedupe identical paged requests within a session ──
    // Survives navigation (Shop → PDP → Shop back) without re-hitting Worker.
    const SS_KEY = `__sf_pp_${window.location.hostname}_${qs || "root"}`;
    const SS_TTL = 15 * 60 * 1000;
    try {
      const cached = sessionStorage.getItem(SS_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < SS_TTL && Array.isArray(data)) return data;
      }
    } catch { /* ignore */ }

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Worker API error: ${res.status}`);
    const json = await res.json();
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ ts: Date.now(), data: json })); } catch { /* quota */ }
    return json;
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
    .order("display_order", { ascending: true })
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
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export { PAGE_SIZE };
