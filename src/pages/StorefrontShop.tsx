import { useOutletContext, useParams, Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { useCallback, useEffect, useRef } from "react";
import { useProductListJsonLd } from "@/hooks/useJsonLd";

const PAGE_SIZE = 14;

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
      <div className="px-2.5 pb-2.5 pt-2 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function StorefrontShop() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const themeConfig = useStorefrontThemeConfig(store.id);
  const cardStyle = themeConfig?.product_card_style || "style-1";
  const isMenuStyle = cardStyle === "style-4";
  const gridClass = isMenuStyle ? "flex flex-col gap-2.5" : "grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";


  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["storefront-shop-all", store.id],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("products")
        .select("id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return { products: data || [], page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.products.length === PAGE_SIZE ? lastPage.page + 1 : undefined,
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.pages.flatMap((p) => p.products) || [];

  useProductListJsonLd({
    products,
    storeSlug: slug || store.slug,
    listName: "Shop All",
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

  return (
    <div className="mx-auto max-w-6xl px-2 sm:px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          to={storefrontPath(slug!, "")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Shop All</h1>
      </div>

      <div style={{ minHeight: 600, contain: "layout" }}>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : isError && products.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border bg-card">
            <p className="text-muted-foreground">Failed to load products</p>
            <button
              onClick={() => refetch()}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product, index) => (
                <UniversalProductCard
                  key={product.id}
                  product={product}
                  slug={slug!}
                  store={store}
                  priority={index < 4}
                  cardStyle={cardStyle}
                />
              ))}
            </div>

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
            <p className="text-muted-foreground">No products yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
