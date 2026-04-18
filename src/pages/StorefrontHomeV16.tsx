/**
 * Theme 16 Home — Best Sellers (12 per batch, infinite scroll) then
 * per-category sections loaded lazily via IntersectionObserver, each
 * with its own 12-product infinite scroll.  Nothing beyond the first
 * 12 best sellers loads on cold start.
 */
import { useState, useMemo, useRef, useEffect, lazy, Suspense, useCallback } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient, useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal, ArrowRight, Loader2 } from "lucide-react";
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

const BATCH_SIZE = 12;

const BEST_SELLER_COLS =
  "id,category,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,slug,stock_quantity,store_id,display_order";

const CATEGORY_PRODUCT_COLS =
  "id,name,slug,price,sale_price,image_url,currency,is_best_selling,stock_quantity,category,display_order,product_images:product_images(id,image_url,display_order)";

/* ─── Infinite-scroll sentinel ─── */
function ScrollSentinel({ onVisible, loading }: { onVisible: () => void; loading: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) onVisible(); }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onVisible]);
  return (
    <div ref={ref} className="flex justify-center py-6">
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
    </div>
  );
}

/* ─── Best Sellers section with infinite scroll ─── */
function BestSellersSection({ storeId, slug, store, cardStyle, isCarousel }: {
  storeId: string; slug: string; store: StoreData; cardStyle: string; isCarousel: boolean;
}) {
  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey: ["storefront-best-sellers-inf", storeId],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = pageParam * BATCH_SIZE;
      const { data: d, error } = await supabase
        .from("products")
        .select(BEST_SELLER_COLS)
        .eq("store_id", storeId)
        .eq("is_active", true)
        .eq("is_best_selling", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);
      if (error) throw error;
      return { products: d || [], page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (last) => last.products.length === BATCH_SIZE ? last.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });

  const products = useMemo(() => data?.pages.flatMap((p) => p.products) ?? [], [data]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    // Single-skeleton policy: edge-injected #sf-skel covers initial load
    return <section style={{ minHeight: 320 }} />;
  }

  if (products.length === 0) return null;

  if (isCarousel) {
    return (
      <Suspense fallback={null}>
        <BestSellingCarousel products={products} slug={slug} store={store} cardStyle={cardStyle} />
      </Suspense>
    );
  }

  return (
    <section>
      <SectionHeading title="🔥 Best Selling" />
      <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product: any, idx: number) => (
          <UniversalProductCard key={product.id} product={product} slug={slug} store={store} priority={idx < 2} cardStyle={cardStyle} />
        ))}
      </div>
      {hasNextPage && (
        <ScrollSentinel onVisible={loadMore} loading={isFetchingNextPage} />
      )}
    </section>
  );
}

const HOME_CAT_LIMIT = 11;

/* ─── "View All" card that fills last grid slot ─── */
function ViewAllCard({ categoryPath, categoryName }: { categoryPath: string; categoryName: string }) {
  return (
    <Link
      to={categoryPath}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-colors"
      style={{ aspectRatio: "4/5" }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10 group-hover:bg-foreground/20 transition-colors">
        <ArrowRight className="h-5 w-5 text-foreground" />
      </div>
      <span className="text-sm font-semibold text-foreground">View All</span>
      <span className="text-xs text-muted-foreground text-center px-2">{categoryName}</span>
    </Link>
  );
}

/* ─── Per-category section — shows 11 products + View All card ─── */
function CategorySection({
  category, storeId, slug, store, cardStyle,
}: {
  category: { id: string; name: string; slug: string };
  storeId: string; slug: string; store: StoreData; cardStyle: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIsVisible(true); obs.disconnect(); } }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { data: products, isLoading } = useQuery({
    queryKey: ["storefront-category-home", storeId, category.name],
    queryFn: async () => {
      const { data: d, error } = await supabase
        .from("products")
        .select(CATEGORY_PRODUCT_COLS)
        .eq("store_id", storeId)
        .eq("is_active", true)
        .eq("category", category.name)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(HOME_CAT_LIMIT + 1);
      if (error) throw error;
      return d || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isVisible,
  });

  if (!isVisible) return <section ref={sectionRef} style={{ minHeight: 220 }} />;
  if (!isLoading && (!products || products.length === 0)) return null;

  const categoryPath = storefrontPath(slug, `category/${category.slug}`);
  const hasMore = (products?.length ?? 0) > HOME_CAT_LIMIT;
  const displayProducts = hasMore ? products!.slice(0, HOME_CAT_LIMIT) : (products || []);

  return (
    <section ref={sectionRef}>
      <SectionHeading title={category.name} />
      {isLoading ? (
        <div style={{ minHeight: 320 }} />
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {displayProducts.map((product: any, idx: number) => (
            <UniversalProductCard key={product.id} product={product} slug={slug} store={store} priority={idx < 2} cardStyle={cardStyle} />
          ))}
          {hasMore && <ViewAllCard categoryPath={categoryPath} categoryName={category.name} />}
        </div>
      )}
    </section>
  );
}

/* ─── Main Home Page ─── */
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
  const categoryStyle = themeConfig?.category_style || "style-11";
  const headerLayout = themeConfig?.header_logo_alignment || "left";
  const hideSearchBar = headerLayout === "left-with-search";
  const isCarousel = (store as any).best_selling_carousel ?? false;

  const sortedCategories = useMemo(() => {
    if (!storeCategories) return [];
    return [...storeCategories].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name));
  }, [storeCategories]);

  // Collect visible product IDs for variant count provider
  const allProductIds = useMemo(() => initialProducts.map((p: any) => p.id), [initialProducts]);

  return (
    <VariantCountProvider productIds={allProductIds}>
      <>
        {/* Search bar */}
        {!hideSearchBar && (
          <div className="backdrop-blur-md px-4 pt-3 pb-1" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", minHeight: 52, contain: "layout style" }}>
            <div className="mx-auto max-w-7xl flex items-center gap-2">
              <button onClick={() => setSearchOpen(true)} className="flex flex-1 items-center gap-2.5 rounded-full bg-accent/60 px-4 py-2.5 text-sm text-foreground/60 transition-colors hover:bg-accent" aria-label="Search products">
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Search products...</span>
              </button>
              <button onClick={() => { setSearchOpen(true); setOpenFilters(true); }} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90" aria-label="Open filters">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {searchOpen && (
          <Suspense fallback={null}>
            <StorefrontSearchOverlay open={searchOpen} onClose={() => { setSearchOpen(false); setOpenFilters(false); }} products={initialProducts} slug={slug!} storeId={store.id} initialFiltersOpen={openFilters} />
          </Suspense>
        )}

        {/* Hero Banner */}
        {((store as any).mobile_hero_url || (store as any).mobile_hero_images) && (
          <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} mobileHeroImages={(store as any).mobile_hero_images} storeName={store.name} />
        )}
        {(store as any).banner_url && (
          <div className="hidden md:block">
            <HeroBannerCarousel images={[(store as any).banner_url]} storeName={store.name} imageClassName="w-full h-auto object-cover" maxHeight="520px" />
          </div>
        )}

        {/* Shop by Category */}
        <UniversalCategories categories={storeCategories} storeSlug={slug!} isLoading={!storeCategories} categoryStyle={categoryStyle} />

        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 pt-4 pb-8 space-y-8">
          {/* Best Sellers — first 12 on cold load, infinite scroll */}
          <BestSellersSection storeId={store.id} slug={slug!} store={store} cardStyle={cardStyle} isCarousel={isCarousel} />

          {/* Per-category sections — lazy loaded via IntersectionObserver, each with infinite scroll */}
          {sortedCategories.map((cat: any) => (
            <CategorySection key={cat.id} category={cat} storeId={store.id} slug={slug!} store={store} cardStyle={cardStyle} />
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
