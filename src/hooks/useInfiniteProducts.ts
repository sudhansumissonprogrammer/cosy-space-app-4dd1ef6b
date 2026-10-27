import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { discoveryPage } from "@/lib/catalogueDiscovery";
import { applyCatalogueOrder, catalogueSort } from "../../supabase/functions/_shared/catalogueOrder";

/**
 * Worker /api/products page size is 20 — must match PRODUCTS_PAGE_SIZE
 * in docs/cloudflare-worker-current.js so offset arithmetic stays aligned
 * with edge cache keys and inline-products hydration.
 */
const PAGE_SIZE = 20;

const PRODUCT_COLUMNS =
  "id,category,created_at,currency,description,image_url,is_active,is_best_selling,is_category_pinned,category_pinned_at,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at,video_url,video_poster_url";

function isProductionHost(): boolean {
  const h = window.location.hostname;
  const isLocal = h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h);
  const isPreview = h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com");
  return !isLocal && !isPreview;
}

interface FetchOpts {
  storeId: string;
  category?: string;
  /** URL slug of the category — lets us skip the name lookup round trip. */
  categorySlug?: string;
  page: number;
  sort?: string;
}


async function fetchPageFromSupabase({ storeId, category, page, sort: _sort }: FetchOpts): Promise<any[]> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("store_id", storeId)
    // Public RLS enforces hidden_by_category; that internal column is not
    // granted to anon and filtering it directly breaks public card reads.
    .eq("is_active", true);

  if (category) q = q.eq("category", category);

  if (category) {
    // Pinned products bubble to top of their category page (newest pin first).
    q = q
      .order("is_category_pinned", { ascending: false })
      .order("category_pinned_at", { ascending: false, nullsFirst: false });
  }

  q = applyCatalogueOrder(q, storeId).range(from, to);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Category pages resolve through the `get_category_products_page` RPC so a
 * product that lives in MULTIPLE categories (products.category = primary +
 * product_categories links) shows up on every category it belongs to. The
 * Worker /api/products path can only filter on the single `category` column,
 * so it is skipped whenever a category filter is active.
 */
async function fetchCategoryPageRpc({ storeId, category, categorySlug, page }: FetchOpts): Promise<any[]> {
  // Cold-load fast path: the slug is known from the URL immediately, so we do
  // NOT have to wait for the category-name lookup before requesting products.
  if (categorySlug) {
    const { data, error } = await (supabase as any).rpc("get_category_products_page_by_slug", {
      _store_id: storeId,
      _category_slug: categorySlug,
      _offset: page * PAGE_SIZE,
      _limit: PAGE_SIZE,
    });
    if (!error) return (data as any[]) || [];
    if (!category) throw error;
  }
  const { data, error } = await (supabase as any).rpc("get_category_products_page", {
    _store_id: storeId,
    _category_name: category,
    _offset: page * PAGE_SIZE,
    _limit: PAGE_SIZE,
  });
  if (error) throw error;
  return (data as any[]) || [];
}

async function fetchPage({ storeId, category, categorySlug, page, sort }: FetchOpts): Promise<any[]> {
  sort = catalogueSort(storeId, sort);
  if ((category || categorySlug) && storeId) {
    // Preserve membership and errors: an unfiltered fallback can expose the
    // entire store when the slug lookup fails.
    return await fetchCategoryPageRpc({ storeId, category, categorySlug, page });
  }

  if (isProductionHost()) {

    // ── Production: use Worker /api/products (cached, KV-backed) ──
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (page > 0) params.set("page", String(page));
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    const url = `${window.location.origin}/api/products${qs ? `?${qs}` : ""}`;

    // Never reuse products embedded in cached HTML or sessionStorage here.
    // On refresh after a dashboard add/delete, the versioned Worker endpoint
    // is the freshness source; `no-store` prevents browser HTTP cache replay.
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Worker API error: ${res.status}`);
    const json = await res.json();
    // Defensive fallback: a stale/broken Worker deploy can return [] even
    // when the store clearly has products (e.g. PostgREST column-permission
    // regression). For the FIRST page only, fall back to direct Supabase so
    // the storefront keeps working until the Worker is redeployed.
    if (page === 0 && Array.isArray(json) && json.length === 0 && storeId) {
      return await fetchPageFromSupabase({ storeId, category, page, sort });
    }
    return json;
  }

  return await fetchPageFromSupabase({ storeId, category, page, sort });
}

/**
 * Shared infinite-scroll hook for Shop All & Category pages.
 * Production → Worker /api/products (cache + KV + DB).
 * Preview   → direct Supabase.
 */
export function useInfiniteProducts(opts: {
  storeId: string | undefined;
  category?: string;
  /** Category URL slug — when set, products load without waiting for the name. */
  categorySlug?: string;
  sort?: string;
  queryKeyPrefix: string;
  /** Extra enabled guard — e.g. wait for category name to resolve */
  ready?: boolean;
}) {
  const { storeId, category, categorySlug, sort, queryKeyPrefix, ready = true } = opts;
  const [searchParams] = useSearchParams();
  const rawPage = searchParams.get("page");
  const page = discoveryPage(rawPage);
  const startPage = (page ?? 1) - 1;

  return useInfiniteQuery({
    queryKey: [
      queryKeyPrefix,
      storeId,
      categorySlug || category || "__all__",
      catalogueSort(storeId || "", sort) || "default",
      PAGE_SIZE,
      ...(startPage > 0 ? [startPage] : []),
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const products = await fetchPage({
        storeId: storeId || "",
        category,
        categorySlug,
        page: pageParam,
        sort,
      });
      return { products, page: pageParam };
    },

    initialPageParam: startPage,
    getNextPageParam: (lastPage) =>
      lastPage.products.length === PAGE_SIZE ? lastPage.page + 1 : undefined,
    enabled: !!storeId && ready && page !== null,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export { PAGE_SIZE };
