/**
 * Theme 16 Home — Best Sellers + per-category product sections (13 each + View All card).
 * No "Popular Products" section.
 */
import { useState, useMemo, useRef, useEffect, lazy, Suspense } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal, Loader2, ArrowRight } from "lucide-react";
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
const CATEGORY_PRODUCT_LIMIT = 13;

/* ─── Per-category section ─── */
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
  const { data: products, isLoading } = useQuery({
    queryKey: ["storefront-category-products", storeId, category.name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, price, sale_price, image_url, currency, is_best_selling, stock_quantity, category, display_order, product_images:product_images(id, image_url, display_order)")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .eq("category", category.name)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(CATEGORY_PRODUCT_LIMIT);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!isLoading && (!products || products.length === 0)) return null;

  const categoryPath = storefrontPath(slug, `category/${category.slug}`);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <h2
          className="text-lg font-bold text-foreground tracking-wide whitespace-nowrap"
          style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC', serif)" }}
        >
          {category.name}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products!.map((product: any, idx: number) => (
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

        <div className="mx-auto max-w-6xl px-2 sm:px-4 pt-4 pb-8 space-y-8">
          {/* Best Sellers */}
          {bestSellingProducts.length > 0 && (
            <Suspense fallback={null}>
              {(store as any).best_selling_carousel ? (
                <BestSellingCarousel products={bestSellingProducts} slug={slug!} store={store} cardStyle={cardStyle} />
              ) : (
                <section>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-border" />
                    <h2 className="text-lg font-bold text-foreground tracking-wide whitespace-nowrap" style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC', serif)" }}>
                      🔥 Best Selling
                    </h2>
                    <div className="h-px flex-1 bg-border" />
                  </div>
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
                  <div ref={bsSentinelRef} className="flex justify-center py-4">
                    {bsIsFetching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                  </div>
                </section>
              )}
            </Suspense>
          )}

          {/* Per-category sections in sorted order */}
          {sortedCategories.map((cat: any, idx: number) => (
            idx < 2 ? (
              <CategorySection
                key={cat.id}
                category={cat}
                storeId={store.id}
                slug={slug!}
                store={store}
                cardStyle={cardStyle}
              />
            ) : (
              <LazyRender key={cat.id} minHeight={400} rootMargin="400px">
                <CategorySection
                  category={cat}
                  storeId={store.id}
                  slug={slug!}
                  store={store}
                  cardStyle={cardStyle}
                />
              </LazyRender>
            )
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
