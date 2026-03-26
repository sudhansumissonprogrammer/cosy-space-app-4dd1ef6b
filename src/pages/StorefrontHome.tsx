import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { supabase } from "@/integrations/supabase/client";
import { Search, ArrowUpDown, SlidersHorizontal, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import BestSellingCarousel from "@/components/storefront/BestSellingCarousel";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import StorefrontInstagramSection from "@/components/storefront/StorefrontInstagramSection";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";

const INITIAL_LIMIT = 20;
const PAGE_SIZE = 20;

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
      <div className="px-2.5 pb-2.5 pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-10" />
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full rounded-lg sm:h-10" />
      </div>
    </div>
  );
}

export default function StorefrontHome() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const [sortOpen, setSortOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useStoreJsonLd({
    storeName: store.name,
    storeSlug: store.slug,
    description: store.description,
    logo: store.logo_url,
    location: store.location,
    whatsappNumber: store.whatsapp_number,
  });

  const allCachedProducts = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const themeConfig = useStorefrontThemeConfig(store.id);

  const cardStyle = themeConfig?.product_card_style || "style-1";
  const categoryStyle = themeConfig?.category_style || "style-1";

  // Split cached products into best-selling and regular
  const bestSellingProducts = useMemo(() => {
    if (!allCachedProducts) return [];
    return allCachedProducts.filter((p: any) => p.is_best_selling);
  }, [allCachedProducts]);

  const initialNonBestSelling = useMemo(() => {
    if (!allCachedProducts) return [];
    return allCachedProducts.filter((p: any) => !p.is_best_selling).slice(0, INITIAL_LIMIT);
  }, [allCachedProducts]);

  // Total products count from prefetched data (set by StorefrontLayout)
  const totalProducts = queryClient.getQueryData<number>(["storefront-total-products", store.id]) ?? allCachedProducts?.length ?? 0;
  const totalNonBestSelling = totalProducts - bestSellingProducts.length;
  const hasMoreBeyondInitial = totalNonBestSelling > INITIAL_LIMIT;

  // Infinite query for products beyond the initial batch
  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["storefront-home-more", store.id, sortBy],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = INITIAL_LIMIT + pageParam * PAGE_SIZE;
      let query = supabase
        .from("products")
        .select("id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .eq("is_best_selling", false);

      // Apply sort
      switch (sortBy) {
        case "price_asc":
          query = query.order("price", { ascending: true });
          break;
        case "price_desc":
          query = query.order("price", { ascending: false });
          break;
        case "newest":
          query = query.order("created_at", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
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

  // Merge initial (from cache) + paginated (from API)
  const displayProducts = useMemo(() => {
    const initial = [...initialNonBestSelling];
    // Apply client-side sort to the initial batch
    switch (sortBy) {
      case "price_asc":
        initial.sort((a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price));
        break;
      case "price_desc":
        initial.sort((a, b) => (b.sale_price ?? b.price) - (a.sale_price ?? a.price));
        break;
      case "newest":
        initial.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return [...initial, ...extraProducts];
  }, [initialNonBestSelling, extraProducts, sortBy]);

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { rootMargin: "300px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <>
      {/* Search bar trigger */}
      <div className="bg-card/80 backdrop-blur-md px-4 pt-3 pb-1">
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

      <StorefrontSearchOverlay
        open={searchOpen}
        onClose={() => { setSearchOpen(false); setOpenFilters(false); }}
        products={allCachedProducts}
        slug={slug!}
        storeId={store.id}
        initialFiltersOpen={openFilters}
      />

      {(categoryStyle === "style-3" || categoryStyle === "style-4") ? (
        <>
          <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} mobileHeroImages={(store as any).mobile_hero_images} storeName={store.name} />
          <UniversalCategories categories={storeCategories} storeSlug={slug!} isLoading={!storeCategories} categoryStyle={categoryStyle} />
        </>
      ) : (
        <>
          <UniversalCategories categories={storeCategories} storeSlug={slug!} isLoading={!storeCategories} categoryStyle={categoryStyle} />
          <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} mobileHeroImages={(store as any).mobile_hero_images} storeName={store.name} />
        </>
      )}

      <div className="mx-auto max-w-6xl px-2 sm:px-4 pt-4 pb-8 space-y-5">
        {bestSellingProducts.length > 0 && (
          (store as any).best_selling_carousel ? (
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
              <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {bestSellingProducts.map((product, idx) => (
                  <UniversalProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 4} cardStyle={cardStyle} />
                ))}
              </div>
            </section>
          )
        )}

        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-5 w-1 rounded-full bg-foreground" />
              <h2 className="text-lg font-bold text-foreground tracking-wide" style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC', serif)" }}>Popular Products</h2>
            </div>
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                aria-label="Sort products"
              >
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {sortBy === "popular" && "Popular"}
                  {sortBy === "price_asc" && "Price: Low"}
                  {sortBy === "price_desc" && "Price: High"}
                  {sortBy === "newest" && "Newest"}
                </span>
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                  {([
                    { value: "popular", label: "Popular" },
                    { value: "price_asc", label: "Price: Low → High" },
                    { value: "price_desc", label: "Price: High → Low" },
                    { value: "newest", label: "Newest First" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                      className={`block w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                        sortBy === opt.value
                          ? "bg-foreground/10 text-foreground font-bold"
                          : "text-foreground hover:bg-accent/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!allCachedProducts ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : displayProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {displayProducts.map((product, idx) => (
                  <UniversalProductCard
                    key={product.id}
                    product={product}
                    slug={slug!}
                    store={store}
                    priority={idx < 4}
                    cardStyle={cardStyle}
                  />
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="flex justify-center py-6">
                {isFetchingNextPage && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* View All link when there are more products */}
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
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
              <p className="text-muted-foreground">No products available yet.</p>
            </div>
          )}
        </section>
      </div>
      <StorefrontInstagramSection store={store} />
    </>
  );
}
