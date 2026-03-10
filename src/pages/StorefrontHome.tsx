import { useState, useMemo } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontHero from "@/components/storefront/StorefrontHero";
import StorefrontCategories from "@/components/storefront/StorefrontCategories";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import BestSellingCarousel from "@/components/storefront/BestSellingCarousel";

import StorefrontSearchBar from "@/components/storefront/StorefrontSearchBar";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [availability, setAvailability] = useState<"all" | "in_stock">("all");
  const [bestSellingFilter, setBestSellingFilter] = useState<"all" | "best_selling">("all");
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const [sortOpen, setSortOpen] = useState(false);

  const applyAndClose = (fn: () => void) => {
    fn();
    setFiltersOpen(false);
  };

  const activeFilterCount = [priceRange, availability !== "all", bestSellingFilter !== "all"].filter(Boolean).length;

  const { data: products, isLoading } = useQuery({
    queryKey: ["storefront-products", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: storeCategories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["storefront-categories", store.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .eq("store_id", store.id)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; slug: string; image_url: string | null }[];
    },
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
  });

  const priceRanges: { label: string; range: [number, number] }[] = [
    { label: "Under ₹500", range: [0, 500] },
    { label: "₹500 – ₹1000", range: [500, 1000] },
    { label: "₹1000 – ₹2000", range: [1000, 2000] },
    { label: "₹2000+", range: [2000, Infinity] },
  ];

  const bestSellingProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p: any) => p.is_best_selling);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const filtered = products.filter((p) => {
      if ((p as any).is_best_selling) return false;
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const effectivePrice = p.sale_price ?? p.price;
      const matchesPrice = !priceRange || (effectivePrice >= priceRange[0] && effectivePrice < priceRange[1]);
      const matchesAvail = availability === "all" || p.stock_quantity > 0;
      const matchesBestSelling = bestSellingFilter === "all" || (p as any).is_best_selling;
      return matchesSearch && matchesPrice && matchesAvail && matchesBestSelling;
    });

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
      default:
        break;
    }
    return sorted;
  }, [products, searchQuery, priceRange, availability, bestSellingFilter, sortBy]);

  return (
    <>
      {/* Search + Filters — seamless with nav */}
      <div className="bg-card/80 backdrop-blur-md px-4 pt-3 pb-1">
        <div className="mx-auto max-w-6xl">
          <div className="relative flex items-center gap-2">
            <StorefrontSearchBar
              products={products}
              slug={slug!}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFiltersOpen(true)}
              className={`h-10 w-10 rounded-full shrink-0 transition-colors ${activeFilterCount > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-accent/60 hover:bg-accent"}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Best Selling Filter */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Best Selling</p>
              <div className="flex gap-2">
                <button
                  onClick={() => applyAndClose(() => setBestSellingFilter("all"))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${bestSellingFilter === "all" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground hover:bg-accent/80"}`}
                >
                  All
                </button>
                <button
                  onClick={() => applyAndClose(() => setBestSellingFilter("best_selling"))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${bestSellingFilter === "best_selling" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground hover:bg-accent/80"}`}
                >
                  Best Selling
                </button>
              </div>
            </div>

            {/* Price Range */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Price Range</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyAndClose(() => setPriceRange(null))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${!priceRange ? "bg-primary text-primary-foreground" : "bg-accent text-foreground hover:bg-accent/80"}`}
                >
                  Any
                </button>
                {priceRanges.map((pr) => (
                  <button
                    key={pr.label}
                    onClick={() => applyAndClose(() => setPriceRange(pr.range))}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${priceRange?.[0] === pr.range[0] ? "bg-primary text-primary-foreground" : "bg-accent text-foreground hover:bg-accent/80"}`}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Availability */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Availability</p>
              <div className="flex gap-2">
                <button
                  onClick={() => applyAndClose(() => setAvailability("all"))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${availability === "all" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground hover:bg-accent/80"}`}
                >
                  All
                </button>
                <button
                  onClick={() => applyAndClose(() => setAvailability("in_stock"))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${availability === "in_stock" ? "bg-primary text-primary-foreground" : "bg-accent text-foreground hover:bg-accent/80"}`}
                >
                  In Stock
                </button>
              </div>
            </div>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => applyAndClose(() => { setPriceRange(null); setAvailability("all"); setBestSellingFilter("all"); })}
                className="text-xs text-destructive hover:underline font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StorefrontCategories
        categories={storeCategories}
        storeSlug={slug!}
        isLoading={categoriesLoading}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">

        {/* Best Selling Section */}
        {bestSellingProducts.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold text-foreground">🔥 Best Selling</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {bestSellingProducts.map((product) => (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  slug={slug!}
                  store={store}
                />
              ))}
            </div>
          </section>
        )}

        {/* Product Grid */}
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-foreground">
              Popular Products
              {filteredProducts.length !== (products?.length || 0) && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredProducts.length} of {products?.length})
                </span>
              )}
            </h2>
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
                          ? "bg-primary/10 text-primary"
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
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  slug={slug!}
                  store={store}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
              <p className="text-muted-foreground">
                {searchQuery ? "No products match your search." : "No products available yet."}
              </p>
            </div>
          )}
        </section>

        
      </div>
    </>
  );
}
