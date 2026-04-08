import { useState, useMemo, useRef, useEffect, lazy, Suspense, useCallback } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts, PRODUCT_COLUMNS, PAGE_SIZE } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import SectionHeading from "@/components/storefront/SectionHeading";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
const StorefrontSearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd, useProductListJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";
import SortDropdown from "@/components/storefront/SortDropdown";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));
import StorefrontTrustStrip from "@/components/storefront/StorefrontTrustStrip";

const ABOVE_FOLD_COUNT = 4;
const POPULAR_LIMIT = 10;

export default function StorefrontHome() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useStoreJsonLd({
    storeName: store.name,
    storeSlug: store.slug,
    description: store.description,
    logo: store.logo_url,
    location: store.location,
    whatsappNumber: store.whatsapp_number,
    customDomain: (store as any)?.custom_domain,
    instagramUrl: (store as any)?.instagram_url,
    facebookUrl: (store as any)?.facebook_url,
    city: (store as any)?.city,
    state: (store as any)?.state,
    businessHours: (store as any)?.business_hours,
  });

  // Fetch initial products independently (shell no longer includes products)
  const { products: initialProducts, isLoading: isInitialLoading, edgeSkelVisible } = useStorefrontProducts(store.id);

  const allCachedProducts = initialProducts;

  useProductListJsonLd({
    products: initialProducts || [],
    storeSlug: store.slug,
    listName: `${store.name} — All Products`,
    customDomain: (store as any)?.custom_domain,
  });
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const themeConfig = useStorefrontThemeConfig(store.id);

  const cardStyle = themeConfig?.product_card_style || "style-1";
  const categoryStyle = themeConfig?.category_style || "style-1";
  const headerLayout = themeConfig?.header_logo_alignment || "left";
  const hideSearchBar = headerLayout === "left-with-search";

  // ── Best-selling products (dedicated query — no page limit) ──
  const { products: bestSellingProducts, hasNextPage: bsHasNext, isFetchingNextPage: bsIsFetching, fetchNextPage: bsFetchNext } = useBestSellingProducts(store.id);
  const bsSentinelRef = useRef<HTMLDivElement>(null);
  const bsScrollRef = useRef({ hasNextPage: bsHasNext, isFetchingNextPage: bsIsFetching, fetchNextPage: bsFetchNext });
  bsScrollRef.current = { hasNextPage: bsHasNext, isFetchingNextPage: bsIsFetching, fetchNextPage: bsFetchNext };

  useEffect(() => {
    const el = bsSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const s = bsScrollRef.current;
        if (entry.isIntersecting && s.hasNextPage && !s.isFetchingNextPage) {
          s.fetchNextPage();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Sort mode determines data strategy ──
  // "popular" (default): use cached initial products + paginate from offset 20
  // Any other sort: paginate entirely from API (offset 0) to guarantee consistent ordering
  const isDefaultSort = sortBy === "popular";

  const initialNonBestSelling = useMemo(() => {
    if (!isDefaultSort || !allCachedProducts.length) return [];
    return allCachedProducts.filter((p: any) => !p.is_best_selling).slice(0, POPULAR_LIMIT);
  }, [allCachedProducts, isDefaultSort]);

  const totalProducts = queryClient.getQueryData<number>(["storefront-total-products", store.id]) ?? allCachedProducts?.length ?? 0;
  const totalNonBestSelling = totalProducts - bestSellingProducts.length;

  // For default sort: skip the first 20 (served from cache)
  // For custom sorts: start from 0 (full API pagination)
  const apiOffset = isDefaultSort ? POPULAR_LIMIT : 0;
  const hasMoreBeyondInitial = isDefaultSort ? totalNonBestSelling > POPULAR_LIMIT : totalNonBestSelling > 0;

  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isPaginatedLoading,
    isError: isPaginatedError,
    refetch: refetchPaginated,
  } = useInfiniteQuery({
    queryKey: ["storefront-home-more", store.id, sortBy],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = apiOffset + pageParam * PAGE_SIZE;
      let query = supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("store_id", store.id)
        .eq("is_active", true)
        .eq("is_best_selling", false);

      // Apply sort with stable tiebreaker to prevent row flickering
      switch (sortBy) {
        case "price_asc":
          query = query.order("price", { ascending: true }).order("id", { ascending: true });
          break;
        case "price_desc":
          query = query.order("price", { ascending: false }).order("id", { ascending: true });
          break;
        case "newest":
          query = query.order("created_at", { ascending: false }).order("id", { ascending: true });
          break;
        default: // "popular"
          query = query.order("created_at", { ascending: false }).order("id", { ascending: true });
      }

      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      return { products: data || [], page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.products.length === PAGE_SIZE ? lastPage.page + 1 : undefined,
    enabled: !!store.id && hasMoreBeyondInitial,
    staleTime: 5 * 60 * 1000,
  });

  const extraProducts = paginatedData?.pages.flatMap((p) => p.products) || [];

  // Merge: for default sort, prepend cached initial products
  // For custom sorts, use only API results (no cache mixing)
  const displayProducts = useMemo(() => {
    if (isDefaultSort) {
      return [...initialNonBestSelling, ...extraProducts];
    }
    return extraProducts;
  }, [initialNonBestSelling, extraProducts, isDefaultSort]);

  // Show loading state for custom sorts on first fetch
  const showSkeleton = (isInitialLoading && !edgeSkelVisible) || (!isDefaultSort && isPaginatedLoading && displayProducts.length === 0);

  // Stable observer — uses refs to avoid recreating IntersectionObserver on every state change
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
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // stable — never recreated

  const allProductIds = useMemo(() => [...bestSellingProducts, ...displayProducts].map((p: any) => p.id), [bestSellingProducts, displayProducts]);

  return (
    <VariantCountProvider productIds={allProductIds}>
    <>
      {/* Search bar trigger — hidden when header already has search */}
      {!hideSearchBar && (
        <div className="backdrop-blur-md px-4 pt-3 pb-1" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", minHeight: 52, contain: "layout style" }}>
          <div className="mx-auto max-w-6xl flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex flex-1 items-center gap-2.5 rounded-full bg-accent/60 px-4 py-2.5 text-sm text-foreground/60 transition-colors hover:bg-accent"
              aria-label="Search products"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Search products...</span>
            </button>
            <button
              onClick={() => { setSearchOpen(true); setOpenFilters(true); }}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90"
              aria-label="Open filters"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {searchOpen && (
        <Suspense fallback={null}>
          <StorefrontSearchOverlay
            open={searchOpen}
            onClose={() => { setSearchOpen(false); setOpenFilters(false); }}
            products={allCachedProducts}
            slug={slug!}
            storeId={store.id}
            initialFiltersOpen={openFilters}
          />
        </Suspense>
      )}

      {(categoryStyle === "style-3" || categoryStyle === "style-4") ? (
        <>
          {/* Mobile hero */}
          {(store as any).mobile_hero_url || (store as any).mobile_hero_images ? (
            <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} mobileHeroImages={(store as any).mobile_hero_images} storeName={store.name} />
          ) : null}
          {/* Desktop hero banner */}
          {(store as any).banner_url && (
            <div className="hidden md:block">
              <HeroBannerCarousel images={[(store as any).banner_url]} storeName={store.name} imageClassName="w-full h-auto object-cover" maxHeight="520px" />
            </div>
          )}
          <UniversalCategories categories={storeCategories} storeSlug={slug!} isLoading={!storeCategories} categoryStyle={categoryStyle} />
        </>
      ) : (
        <>
          <UniversalCategories categories={storeCategories} storeSlug={slug!} isLoading={!storeCategories} categoryStyle={categoryStyle} />
          {/* Mobile hero */}
          {(store as any).mobile_hero_url || (store as any).mobile_hero_images ? (
            <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} mobileHeroImages={(store as any).mobile_hero_images} storeName={store.name} />
          ) : null}
          {/* Desktop hero banner */}
          {(store as any).banner_url && (
            <div className="hidden md:block">
              <HeroBannerCarousel images={[(store as any).banner_url]} storeName={store.name} imageClassName="w-full h-auto object-cover" maxHeight="520px" />
            </div>
          )}
        </>
      )}

      <div className="mx-auto max-w-6xl px-2 sm:px-4 pt-4 pb-8 space-y-5">
      {bestSellingProducts.length > 0 && (
          <Suspense fallback={null}>
            {(store as any).best_selling_carousel ? (
              <BestSellingCarousel products={bestSellingProducts} slug={slug!} store={store} cardStyle={cardStyle} />
            ) : (
              <section>
                <SectionHeading title="🔥 Best Selling" />
                <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {bestSellingProducts.slice(0, ABOVE_FOLD_COUNT).map((product, idx) => (
                    <UniversalProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 2} cardStyle={cardStyle} />
                  ))}
                </div>
                {bestSellingProducts.length > ABOVE_FOLD_COUNT && (
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 mt-1.5 sm:mt-4">
                      {bestSellingProducts.slice(ABOVE_FOLD_COUNT).map((product) => (
                        <UniversalProductCard key={product.id} product={product} slug={slug!} store={store} priority={false} cardStyle={cardStyle} />
                      ))}
                    </div>
                )}
                {/* Best-seller infinite scroll sentinel */}
                <div ref={bsSentinelRef} className="flex justify-center py-4">
                  {bsIsFetching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
              </section>
            )}
          </Suspense>
        )}

        <section style={{ minHeight: 600, contain: "layout" }}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <SectionHeading title="🔥 Popular Products" className="flex-1" />
            <SortDropdown value={sortBy} onChange={setSortBy} />
          </div>

          {showSkeleton ? (
            <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : isPaginatedError && displayProducts.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border bg-card">
              <p className="text-muted-foreground">Failed to load products</p>
              <button
                onClick={() => refetchPaginated()}
                className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : displayProducts.length > 0 ? (
            <>
              {/* Above-fold: first 4 products render immediately */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {displayProducts.slice(0, ABOVE_FOLD_COUNT).map((product, idx) => (
                  <UniversalProductCard
                    key={product.id}
                    product={product}
                    slug={slug!}
                    store={store}
                    priority={idx < 2}
                    cardStyle={cardStyle}
                  />
                ))}
              </div>

              {/* Below-fold: deferred until near viewport */}
              {displayProducts.length > ABOVE_FOLD_COUNT && (
                <LazyRender minHeight={600} rootMargin="300px">
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 mt-1.5 sm:mt-4">
                    {displayProducts.slice(ABOVE_FOLD_COUNT).map((product) => (
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
              <div ref={sentinelRef} className="flex justify-center py-6">
                {isFetchingNextPage && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* View All link when infinite scroll is exhausted */}
              {!hasNextPage && totalProducts > 8 && (
                <div className="flex justify-center pt-2">
                  <Link
                    to={storefrontPath(slug!, "shop")}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                  >
                    View All Products
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center rounded-lg border bg-card">
              <p className="text-muted-foreground">No products available yet.</p>
            </div>
          )}
        </section>
      </div>
      <StorefrontTrustStrip storeId={store.id} currency={store.currency} />
      <LazyRender minHeight={200} rootMargin="400px">
        <Suspense fallback={null}>
          <StorefrontInstagramSection store={store} />
        </Suspense>
      </LazyRender>
    </>
    </VariantCountProvider>
  );
}
