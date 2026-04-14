/**
 * Theme 16 Home — Best Sellers + per-category product sections (13 each + View All card).
 * No "Popular Products" section.
 */
import { useState, useMemo, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal, Loader2, ArrowRight } from "lucide-react";
import SectionHeading from "@/components/storefront/SectionHeading";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
const StorefrontSearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));
import StorefrontTrustStrip from "@/components/storefront/StorefrontTrustStrip";

const ABOVE_FOLD_COUNT = 4;
const CATEGORY_PAGE_SIZE = 12;

/* ─── Per-category section with infinite scroll ─── */
function CategorySection({
  category,
  storeId,
  slug,
  store,
  cardStyle,
}: {
  category: { id: string; name: string; slug: string };
  storeId: string;
  slug: string;
  store: StoreData;
  cardStyle: string;
}) {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const pageRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollState = useRef({ hasMore: true, isFetchingMore: false });
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  // Only become visible (and start fetching) when section enters viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fetchPage = useCallback(async (page: number) => {
    const from = page * CATEGORY_PAGE_SIZE;
    const to = from + CATEGORY_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, price, sale_price, image_url, currency, is_best_selling, stock_quantity, category, display_order, product_images:product_images(id, image_url, display_order)")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .eq("is_best_selling", false)
      .eq("category", category.name)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data || [];
  }, [storeId, category.name]);

  useEffect(() => {
    if (!isVisible || hasFetched.current) return;
    hasFetched.current = true;
    setIsLoading(true);
    let cancelled = false;
    fetchPage(0).then((data) => {
      if (cancelled) return;
      setProducts(data);
      setHasMore(data.length === CATEGORY_PAGE_SIZE);
      scrollState.current.hasMore = data.length === CATEGORY_PAGE_SIZE;
      setIsLoading(false);
    }).catch(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const s = scrollState.current;
        if (entry.isIntersecting && s.hasMore && !s.isFetchingMore) {
          s.isFetchingMore = true;
          setIsFetchingMore(true);
          const nextPage = pageRef.current + 1;
          fetchPage(nextPage).then((data) => {
            pageRef.current = nextPage;
            setProducts((prev) => [...prev, ...data]);
            const more = data.length === CATEGORY_PAGE_SIZE;
            setHasMore(more);
            scrollState.current = { hasMore: more, isFetchingMore: false };
            setIsFetchingMore(false);
          }).catch(() => {
            scrollState.current.isFetchingMore = false;
            setIsFetchingMore(false);
          });
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage]);

  if (!isVisible) {
    // Render a lightweight placeholder so IntersectionObserver can track it
    return <section ref={sectionRef} style={{ minHeight: 200 }} />;
  }

  if (!isLoading && hasFetched.current && products.length === 0) return null;

  const categoryPath = storefrontPath(slug, `category/${category.slug}`);

  return (
    <section ref={sectionRef}>
      <SectionHeading title={category.name} />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product: any) => (
              <UniversalProductCard
                key={product.id}
                product={product}
                slug={slug}
                store={store}
                priority={false}
                cardStyle={cardStyle}
              />
            ))}
            {/* View All card */}
            <Link
              to={categoryPath}
              className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-accent/30 transition-all hover:border-foreground/30 hover:bg-accent/50"
              style={{ aspectRatio: "4/5" }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10 transition-colors group-hover:bg-foreground/20">
                <ArrowRight className="h-5 w-5 text-foreground" />
              </div>
              <span className="mt-3 text-sm font-semibold text-foreground">View All</span>
              <span className="text-xs text-muted-foreground">{category.name}</span>
            </Link>
          </div>
          <div ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        </>
      )}
    </section>
  );
}
export default function StorefrontHomeV16() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);

  useStoreJsonLd({
    storeName: store.name,
    storeSlug: store.slug,
    description: store.description,
    logo: store.logo_url,
    location: store.location,
    whatsappNumber: store.whatsapp_number,
    customDomain: (store as any)?.custom_domain,
  });

  const { products: initialProducts, isLoading: isInitialLoading } = useStorefrontProducts(store.id);
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const themeConfig = useStorefrontThemeConfig(store.id);

  const cardStyle = themeConfig?.product_card_style || "style-1";
  const categoryStyle = themeConfig?.category_style || "style-1";
  const headerLayout = themeConfig?.header_logo_alignment || "left";
  const hideSearchBar = headerLayout === "left-with-search";

  // Best-selling products with infinite scroll
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

  // Categories sorted by display_order (comes from shell data)
  const sortedCategories = useMemo(() => {
    if (!storeCategories) return [];
    return [...storeCategories].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name));
  }, [storeCategories]);

  const allProductIds = useMemo(() => bestSellingProducts.map((p: any) => p.id), [bestSellingProducts]);

  return (
    <VariantCountProvider productIds={allProductIds}>
      <>
        {/* Search bar */}
        {!hideSearchBar && (
          <div className="backdrop-blur-md px-4 pt-3 pb-1" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", minHeight: 52, contain: "layout style" }}>
            <div className="mx-auto max-w-7xl flex items-center gap-2">
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
              products={initialProducts}
              slug={slug!}
              storeId={store.id}
              initialFiltersOpen={openFilters}
            />
          </Suspense>
        )}

        {/* Categories + Hero */}
        {(categoryStyle === "style-3" || categoryStyle === "style-4") ? (
          <>
            {(store as any).mobile_hero_url || (store as any).mobile_hero_images ? (
              <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} mobileHeroImages={(store as any).mobile_hero_images} storeName={store.name} />
            ) : null}
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
            {(store as any).mobile_hero_url || (store as any).mobile_hero_images ? (
              <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} mobileHeroImages={(store as any).mobile_hero_images} storeName={store.name} />
            ) : null}
            {(store as any).banner_url && (
              <div className="hidden md:block">
                <HeroBannerCarousel images={[(store as any).banner_url]} storeName={store.name} imageClassName="w-full h-auto object-cover" maxHeight="520px" />
              </div>
            )}
          </>
        )}

        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 pt-4 pb-8 space-y-8">
          {/* Best Sellers */}
          {bestSellingProducts.length > 0 && (
            <Suspense fallback={null}>
              {(store as any).best_selling_carousel ? (
                <BestSellingCarousel products={bestSellingProducts} slug={slug!} store={store} cardStyle={cardStyle} />
              ) : (
                <section>
                <SectionHeading title="🔥 Best Selling" />
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {bestSellingProducts.slice(0, ABOVE_FOLD_COUNT).map((product: any, idx: number) => (
                      <UniversalProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 2} cardStyle={cardStyle} />
                    ))}
                  </div>
                  {bestSellingProducts.length > ABOVE_FOLD_COUNT && (
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 mt-1.5 sm:mt-4">
                      {bestSellingProducts.slice(ABOVE_FOLD_COUNT).map((product: any) => (
                        <UniversalProductCard key={product.id} product={product} slug={slug!} store={store} priority={false} cardStyle={cardStyle} />
                      ))}
                    </div>
                  )}
                </section>
              )}
              {/* Infinite scroll sentinel — always active for both carousel & grid */}
              <div ref={bsSentinelRef} className="flex justify-center py-4">
                {bsIsFetching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
            </Suspense>
          )}

          {/* Per-category sections in sorted order */}
          {sortedCategories.map((cat: any) => (
            <CategorySection
              key={cat.id}
              category={cat}
              storeId={store.id}
              slug={slug!}
              store={store}
              cardStyle={cardStyle}
            />
          ))}
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
