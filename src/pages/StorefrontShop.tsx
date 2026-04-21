import { useOutletContext, useParams, Link } from "react-router-dom";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProductListJsonLd } from "@/hooks/useJsonLd";
import { useInfiniteProducts, PAGE_SIZE } from "@/hooks/useInfiniteProducts";
import ShopFilterBar, { applySort, type SortKey } from "@/components/storefront/ShopFilterBar";
import CategoryQuickJump from "@/components/storefront/CategoryQuickJump";
import ShopEmptyState from "@/components/storefront/ShopEmptyState";
import BackToTop from "@/components/storefront/BackToTop";

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
  // Tighter mobile gutters → more card width
  const gridClass = isMenuStyle
    ? "flex flex-col gap-2.5"
    : "grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5";

  const [sort, setSort] = useState<SortKey>("default");

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts({
    storeId: store.id,
    queryKeyPrefix: "shop-all-v3",
  });

  const rawProducts = data?.pages.flatMap((p) => p.products) || [];
  const products = useMemo(() => applySort(rawProducts, sort), [rawProducts, sort]);
  const totalEstimate = hasNextPage ? `${rawProducts.length}+` : rawProducts.length;

  const signalled = useRef(false);
  useEffect(() => {
    if (!signalled.current && !isLoading && data !== undefined) {
      signalled.current = true;
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("storefront:content-ready"));
      });
    }
  }, [isLoading, data]);

  useProductListJsonLd({
    products: rawProducts,
    storeSlug: slug || store.slug,
    listName: "Shop All",
    customDomain: (store as any)?.custom_domain,
  });

  const sentinelElRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((el: HTMLDivElement | null) => { sentinelElRef.current = el; }, []);

  const pageCount = data?.pages.length ?? 0;
  useEffect(() => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    const el = sentinelElRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchNextPage(); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, pageCount]);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-5">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to={storefrontPath(slug!, "")} className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Shop All</span>
      </nav>

      <div className="mb-4 flex items-center gap-3">
        <Link
          to={storefrontPath(slug!, "")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Shop All</h1>
      </div>

      {/* Category quick-jump strip */}
      <CategoryQuickJump storeId={store.id} slug={slug!} />

      {/* Sticky filter/sort bar */}
      <ShopFilterBar
        total={totalEstimate || rawProducts.length}
        showing={products.length}
        sort={sort}
        onSortChange={setSort}
      />

      <div style={{ minHeight: 600 }} className="mt-3">
        {isLoading ? (
          <div className={gridClass}>
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
            <div className={gridClass}>
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
              {!hasNextPage && rawProducts.length > PAGE_SIZE && (
                <p className="text-sm text-muted-foreground">You've seen all products</p>
              )}
            </div>
          </>
        ) : (
          <ShopEmptyState
            slug={slug!}
            title={sort === "in-stock" ? "Nothing in stock matches" : "No products yet"}
            message={sort === "in-stock" ? "Try removing the In Stock filter or browse all categories." : "Browse our categories to discover something special."}
          />
        )}
      </div>

      <BackToTop />
    </div>
  );
}
