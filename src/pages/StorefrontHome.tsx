import { useState, useMemo } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontCategories from "@/components/storefront/StorefrontCategories";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import BestSellingCarousel from "@/components/storefront/BestSellingCarousel";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";

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

  useStoreJsonLd({
    storeName: store.name,
    storeSlug: store.slug,
    description: store.description,
    logo: store.logo_url,
    location: store.location,
    whatsappNumber: store.whatsapp_number,
  });

  // Read directly from pre-seeded cache — zero fetch, instant render
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  const bestSellingProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p: any) => p.is_best_selling);
  }, [products]);

  const nonBestSellingProducts = useMemo(() => {
    if (!products) return [];
    const filtered = products.filter((p) => !(p as any).is_best_selling);
    const sorted = [...filtered];
    switch (sortBy) {
      case "price_asc":
        sorted.sort((a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price));
        break;
      case "price_desc":
        sorted.sort((a, b) => (b.sale_price ?? b.price) - (a.sale_price ?? a.price));
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return sorted;
  }, [products, sortBy]);

  return (
    <>
      {/* Search bar trigger */}
      <div className="bg-card/80 backdrop-blur-md px-4 pt-3 pb-1">
        <div className="mx-auto max-w-6xl flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2.5 rounded-full bg-accent/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span>Search products...</span>
          </button>
          <button
            onClick={() => { setSearchOpen(true); setOpenFilters(true); }}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Full-screen search overlay */}
      <StorefrontSearchOverlay
        open={searchOpen}
        onClose={() => { setSearchOpen(false); setOpenFilters(false); }}
        products={products}
        slug={slug!}
        initialFiltersOpen={openFilters}
      />

      <StorefrontCategories
        categories={storeCategories}
        storeSlug={slug!}
        isLoading={!storeCategories}
      />

      <StorefrontMobileHero mobileHeroUrl={(store as any).mobile_hero_url} storeName={store.name} />

      <div className="mx-auto max-w-6xl px-2 sm:px-4 pt-4 pb-8 space-y-5">
        {/* Best Selling Section */}
        {bestSellingProducts.length > 0 && (
          (store as any).best_selling_carousel ? (
            <BestSellingCarousel products={bestSellingProducts} slug={slug!} store={store} />
          ) : (
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-border" />
                <h2 className="text-lg font-bold text-foreground tracking-wide whitespace-nowrap" style={{ fontFamily: "'Alegreya SC', serif" }}>
                  🔥 Best Selling
                </h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {bestSellingProducts.map((product, idx) => (
                  <StorefrontProductCard
                    key={product.id}
                    product={product}
                    slug={slug!}
                    store={store}
                    priority={idx < 4}
                  />
                ))}
              </div>
            </section>
          )
        )}

        {/* Product Grid */}
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-5 w-1 rounded-full bg-foreground" />
              <h2 className="text-lg font-bold text-foreground tracking-wide" style={{ fontFamily: "'Alegreya SC', serif" }}>Popular Products</h2>
            </div>
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
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
          {!products ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : nonBestSellingProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {nonBestSellingProducts.map((product, idx) => (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  slug={slug!}
                  store={store}
                  priority={idx < 4}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
              <p className="text-muted-foreground">No products available yet.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}