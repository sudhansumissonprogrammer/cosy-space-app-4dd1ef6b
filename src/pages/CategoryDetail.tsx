import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import { storefrontPath } from "@/lib/subdomain";
import { useCallback, useEffect, useRef } from "react";
import { useProductListJsonLd } from "@/hooks/useJsonLd";

const PAGE_SIZE = 14;

export default function CategoryDetail() {
  const store = useOutletContext<StoreData>();
  const { slug, categorySlug } = useParams<{ slug: string; categorySlug: string }>();
  const navigate = useNavigate();
  const themeConfig = useStorefrontThemeConfig(store.id);
  const storeTheme = (store as any)?.theme || "starter";
  const cardStyle = themeConfig?.product_card_style || (storeTheme === "theme-13" ? "style-4" : "style-1");
  const isMenuStyle = cardStyle === "style-4";

  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ["category", store.id, categorySlug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .eq("store_id", store.id)
        .eq("slug", categorySlug)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; slug: string; image_url: string | null } | null;
    },
    enabled: !!store.id && !!categorySlug,
  });

  const {
    data,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["category-products", store.id, category?.name],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("products")
        .select("id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .eq("category", category!.name)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return { products: data || [], page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.products.length === PAGE_SIZE ? lastPage.page + 1 : undefined,
    enabled: !!store.id && !!category?.name,
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.pages.flatMap((p) => p.products) || [];

  const contentReadyRef = useRef(false);
  const gridRef = useStaggerReveal<HTMLDivElement>();

  useEffect(() => {
    contentReadyRef.current = false;
  }, [categorySlug]);

  useEffect(() => {
    if (contentReadyRef.current || categoryLoading || productsLoading) return;
    contentReadyRef.current = true;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("storefront:content-ready"));
    });
  }, [categoryLoading, productsLoading, categorySlug]);

  // Category-level meta tags
  useEffect(() => {
    if (!category || !store) return;
    const prevTitle = document.title;
    const count = products.length;
    document.title = `${category.name} — ${store.name} | Shop Online`;
    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute("content") || "";
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", `Browse ${count > 0 ? count + " " : ""}products in ${category.name} at ${store.name}. Fast delivery & easy returns.`);
    return () => {
      document.title = prevTitle;
      metaDesc?.setAttribute("content", prevDesc);
    };
  }, [category, store, products.length]);

  useProductListJsonLd({
    products,
    storeSlug: slug || store.slug,
    listName: category?.name || "Category",
    customDomain: (store as any)?.custom_domain,
  });

  const sentinelElRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    sentinelElRef.current = el;
  }, []);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    const el = sentinelElRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!categoryLoading && !category) {
    return (
      <div className="mx-auto max-w-6xl px-2 sm:px-4 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate(storefrontPath(slug!, ""))} className="mb-4 rounded-full bg-background text-foreground shadow-sm hover:shadow-md">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
          <p className="text-muted-foreground">Category not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(storefrontPath(slug!, ""))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-foreground">{category?.name || "Category"}</h1>
      </div>

      <div style={{ minHeight: 600, contain: "layout" }}>
        {categoryLoading || productsLoading ? (
          <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
                <div className="px-2.5 pb-2.5 pt-2 space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : productsError && products.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border bg-card">
            <p className="text-muted-foreground">Failed to load products</p>
            <button
              onClick={() => refetchProducts()}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : products.length > 0 ? (
          <>
            {isMenuStyle ? (
              <div className="flex flex-col gap-2.5">
                {products.map((product, idx) => (
                  <UniversalProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 4} cardStyle={cardStyle} />
                ))}
              </div>
            ) : (
              <div ref={gridRef} className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product, idx) => (
                  <UniversalProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 4} cardStyle={cardStyle} />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="flex justify-center py-8">
              {isFetchingNextPage && (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              )}
              {!hasNextPage && products.length > PAGE_SIZE && (
                <p className="text-sm text-muted-foreground">You've seen all products</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
            <p className="text-muted-foreground">No products in this category yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
