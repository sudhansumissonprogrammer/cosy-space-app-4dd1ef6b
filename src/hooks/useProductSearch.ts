import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSearchQuery } from "@/lib/searchSynonyms";

export const SEARCH_PAGE_SIZE = 24;

export interface SearchHit {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  category: string | null;
  stock_quantity: number | null;
  is_best_selling: boolean | null;
  sku: string | null;
  currency: string | null;
  created_at: string;
  score: number;
  total_count: number;
}

export type SearchSort = "relevance" | "price_asc" | "price_desc" | "newest";

export interface SearchFilters {
  sort?: SearchSort;
  minPrice?: number | null;
  maxPrice?: number | null;
  category?: string | null;
}

async function runSearch(
  storeId: string,
  query: string,
  page: number,
  filters: SearchFilters
): Promise<SearchHit[]> {
  const { data, error } = await (supabase as any).rpc("search_products", {
    p_store_id: storeId,
    p_query: normalizeSearchQuery(query),
    p_limit: SEARCH_PAGE_SIZE,
    p_offset: page * SEARCH_PAGE_SIZE,
    p_sort: filters.sort || "relevance",
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_category: filters.category ?? null,
  });
  if (error) throw error;
  return (data as SearchHit[]) || [];
}

/** Debounce any value (used for as-you-type suggestions). */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Full search results page — infinite scroll. */
export function useProductSearch(
  storeId: string | undefined,
  query: string,
  filters: SearchFilters = {}
) {
  const q = (query || "").trim();

  const result = useInfiniteQuery({
    queryKey: [
      "product-search",
      storeId,
      normalizeSearchQuery(q),
      filters.sort || "relevance",
      filters.minPrice ?? null,
      filters.maxPrice ?? null,
      filters.category ?? null,
    ],
    queryFn: ({ pageParam = 0 }) => runSearch(storeId!, q, pageParam as number, filters),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === SEARCH_PAGE_SIZE ? allPages.length : undefined,
    enabled: !!storeId && q.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const hits = result.data?.pages.flat() || [];
  const total = hits[0]?.total_count ?? 0;

  return { ...result, hits, total };
}

/** Lightweight suggestion feed for the search box (products + categories). */
export function useSearchSuggestions(storeId: string | undefined, query: string) {
  const debouncedQuery = useDebounced(query, 200);
  const q = debouncedQuery.trim();

  const products = useQuery({
    queryKey: ["search-suggest-products", storeId, normalizeSearchQuery(q)],
    queryFn: () => runSearch(storeId!, q, 0, { sort: "relevance" }),
    enabled: !!storeId && q.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const categories = useQuery({
    queryKey: ["search-suggest-terms", storeId, q.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("search_suggest_terms", {
        p_store_id: storeId,
        p_query: q,
        p_limit: 5,
      });
      if (error) throw error;
      return (data as { term: string; kind: string; hits: number }[]) || [];
    },
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
  });

  return {
    products: (products.data || []).slice(0, 8),
    categories: categories.data || [],
    isLoading: products.isFetching && q.length > 0,
  };
}
