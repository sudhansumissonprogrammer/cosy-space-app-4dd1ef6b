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
import { useCanonical } from "@/hooks/useCanonical";
import { getStoreBaseUrl } from "@/lib/storeUrl";

const PAGE_SIZE = 20;
// Lightweight card columns — drop heavy joins (product_images, product_variants)
// Previously this page used select("*", product_images(...), product_variants(...))
// which exploded payload size for stores with 100+ best-sellers.
const CARD_COLUMNS =
  "id,category,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,slug,stock_quantity,store_id";

function ProductCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
        border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)",
      }}
    >
      <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
      <div className="px-2.5 pb-2.5 pt-2 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function StorefrontBestSellers() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const themeConfig = useStorefrontThemeConfig(store.id);
  const cardStyle = themeConfig?.product_card_style || "style-1";
  useCanonical(`${getStoreBaseUrl(slug || store.slug, (store as any)?.custom_domain)}/best-sellers`);

  // Themes that use Best Sellers as the full catalog
  const showAll = ["theme-10", "theme-12"].includes(store.theme);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: showAll
      ? ["best-sellers-all-v2", store.id]
      : ["best-sellers-only-v2", store.id],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("products")
        .select(CARD_COLUMNS)
        .eq("store_id", store.id)
        .eq("is_active", true);
      if (!showAll) q = q.eq("is_best_selling", true);
      const { data: prods, error } = await q
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return { products: prods ?? [], page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.products.length === PAGE_SIZE ? last.page + 1 : undefined,
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const products = data?.pages.flatMap((p) => p.products) || [];
  const totalEstimate = hasNextPage ? `${products.length}+` : products.length;
  const pageTitle = showAll ? "Shop All" : "🔥 Best Sellers";

  // Infinite scroll sentinel
  const sentinelElRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    sentinelElRef.current = el;
  }, []);
  const pageCount = data?.pages.length ?? 0;
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    const el = sentinelElRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage();
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, pageCount]);

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          to={storefrontPath(slug!, "")}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{
            backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
            border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)",
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
          {pageTitle}
        </h1>
        {!isLoading && (
          <span className="text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
            ({totalEstimate} products)
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
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
        <div
          className="flex min-h-[200px] items-center justify-center rounded-lg"
          style={{
            backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
            border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)",
          }}
        >
          <p style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
            No products yet.
          </p>
        </div>
      )}
    </div>
  );
}
