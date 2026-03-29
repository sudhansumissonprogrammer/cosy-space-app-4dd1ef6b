import { useOutletContext, useParams, Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import LazyRender from "@/components/storefront/LazyRender";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { useEffect, useRef } from "react";

const ABOVE_FOLD_COUNT = 4;

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
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // Stable observer — uses ref to avoid recreating on every state change
  const scrollStateRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage });
  scrollStateRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const s = scrollStateRef.current;
        if (entry.isIntersecting && s.hasNextPage && !s.isFetchingNextPage) {
          s.fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // stable — never recreated

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          to={storefrontPath(slug!, "")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Shop All</h1>
        {products.length > 0 && (
          <span className="text-sm text-muted-foreground">({products.length} products)</span>
        )}
      </div>

      <div style={{ minHeight: 600, contain: "layout" }}>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
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
            {products.slice(0, ABOVE_FOLD_COUNT).map((product, index) => (
              <UniversalProductCard
                key={product.id}
                product={product}
                slug={slug!}
                store={store}
                priority={index < 2}
                cardStyle={cardStyle}
              />
            ))}
          </div>
          {products.length > ABOVE_FOLD_COUNT && (
            <LazyRender minHeight={600} rootMargin="300px">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 mt-1.5 sm:mt-4">
                {products.slice(ABOVE_FOLD_COUNT).map((product) => (
                  <UniversalProductCard
                    key={product.id}
                    product={product}
                    slug={slug!}
                    store={store}
                    priority={false}
                    cardStyle={cardStyle}
                  />
                ))}
              </div>
            </LazyRender>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-8">
            {isFetchingNextPage && (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
