/**
 * StorefrontHomeV14 — "Classic Center" home page
 * Identical to StorefrontHome (theme-1) except:
 * - Marquee strip is rendered AFTER the hero image (not in the layout header)
 * - Default card style: style-2
 * - Default category style: style-3 (square grid)
 */
import { useState, useMemo, useRef, useCallback, useEffect, lazy, Suspense } from "react";
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
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));
import StorefrontTrustStrip from "@/components/storefront/StorefrontTrustStrip";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";
import SortDropdown from "@/components/storefront/SortDropdown";

const ABOVE_FOLD_COUNT = 4;
const POPULAR_LIMIT = 10;

export function ClassicCenterHome({ defaultCardStyle = "style-2", defaultCategoryStyle = "style-4" }: { defaultCardStyle?: string; defaultCategoryStyle?: string } = {}) {
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
  });

  const { products: initialProducts, isLoading: isInitialLoading, edgeSkelVisible } = useStorefrontProducts(store.id);
  const allCachedProducts = initialProducts;
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const themeConfig = useStorefrontThemeConfig(store.id);

  const cardStyle = themeConfig?.product_card_style || defaultCardStyle;
  const categoryStyle = themeConfig?.category_style || defaultCategoryStyle;
  const headerLayout = themeConfig?.header_logo_alignment || "center";
  const hideSearchBar = headerLayout === "left-with-search";
  const marqueeText = themeConfig?.marquee_text;
  const marqueeEnabled = themeConfig?.marquee_enabled ?? true;

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

  const isDefaultSort = sortBy === "popular";

  const initialNonBestSelling = useMemo(() => {
    if (!isDefaultSort || !allCachedProducts.length) return [];
    return allCachedProducts.filter((p: any) => !p.is_best_selling).slice(0, POPULAR_LIMIT);
  }, [allCachedProducts, isDefaultSort]);

  const totalProducts = queryClient.getQueryData<number>(["storefront-total-products", store.id]) ?? allCachedProducts?.length ?? 0;
  const totalNonBestSelling = totalProducts - bestSellingProducts.length;

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
        default:
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

  const displayProducts = useMemo(() => {
    if (isDefaultSort) {
      return [...initialNonBestSelling, ...extraProducts];
    }
    return extraProducts;
  }, [initialNonBestSelling, extraProducts, isDefaultSort]);

  const showSkeleton = (isInitialLoading && !edgeSkelVisible) || (!isDefaultSort && isPaginatedLoading && displayProducts.length === 0);

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
  }, []);

  return (
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

      {/* Mobile hero (mobile only) */}
      {(store as any).mobile_hero_url || (store as any).mobile_hero_images ? (
        <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} mobileHeroImages={(store as any).mobile_hero_images} storeName={store.name} />
      ) : null}
      {/* Desktop hero banner (desktop only) */}
      {(store as any).banner_url && (
        <div className="hidden md:block">
          <HeroBannerCarousel images={[(store as any).banner_url]} storeName={store.name} imageClassName="w-full h-auto object-cover" maxHeight="520px" />
        </div>
      )}

      {/* Marquee strip — rendered AFTER hero (key difference from theme-1) */}
      {marqueeEnabled !== false && <StorefrontMarquee text={marqueeText} />}

      {/* Categories */}
      {storeCategories && storeCategories.length > 0 && (
        <div className="mx-auto max-w-6xl px-2 sm:px-4 pt-4">
          <SectionHeading title="Shop by Category" />
        </div>
      )}
      <UniversalCategories categories={storeCategories} storeSlug={slug!} isLoading={!storeCategories} categoryStyle={categoryStyle} />

      <div className="mx-auto max-w-6xl px-2 sm:px-4 pt-4 pb-8 space-y-5">
        {bestSellingProducts.length > 0 && (
          <Suspense fallback={null}>
            {(store as any).best_selling_carousel ? (
              <BestSellingCarousel products={bestSellingProducts} slug={slug!} store={store} cardStyle={cardStyle} />
            ) : (
              <section>
                <SectionHeading title="🔥 Best Selling" />
                <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 stagger-grid">
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
                <div ref={bsSentinelRef} className="flex justify-center py-4">
                  {bsIsFetching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
              </section>
            )}
          </Suspense>
        )}

        <section style={{ minHeight: 600, contain: "layout style" }}>
          <div className="mb-5 flex items-center justify-between gap-3" style={{ minHeight: 32 }}>
            <SectionHeading title="🔥 Popular Products" className="flex-1" />
            <SortDropdown value={sortBy} onChange={setSortBy} />
          </div>

          {showSkeleton ? (
            <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 stagger-grid" style={{ minHeight: 560 }}>
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
              <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 stagger-grid" style={{ minHeight: 560 }}>
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

              <div ref={sentinelRef} className="flex justify-center py-6">
                {isFetchingNextPage && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>

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
  );
}

export default function StorefrontHomeV14() {
  return <ClassicCenterHome defaultCardStyle="style-2" defaultCategoryStyle="style-4" />;
}
