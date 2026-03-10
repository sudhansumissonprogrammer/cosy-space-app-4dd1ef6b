import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontHero from "@/components/storefront/StorefrontHero";
import StorefrontCategories from "@/components/storefront/StorefrontCategories";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import StorefrontAbout from "@/components/storefront/StorefrontAbout";

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
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Animate filter panel open/close
  useEffect(() => {
    if (filtersOpen) {
      setFiltersVisible(true);
    } else {
      const timer = setTimeout(() => setFiltersVisible(false), 250);
      return () => clearTimeout(timer);
    }
  }, [filtersOpen]);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [availability, setAvailability] = useState<"all" | "in_stock">("all");
  const [bestSellingFilter, setBestSellingFilter] = useState<"all" | "best_selling">("all");
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    };
    if (filtersOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filtersOpen]);

  const activeFilterCount = [selectedCategory, priceRange, availability !== "all"].filter(Boolean).length;

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

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      const effectivePrice = p.sale_price ?? p.price;
      const matchesPrice = !priceRange || (effectivePrice >= priceRange[0] && effectivePrice < priceRange[1]);
      const matchesAvail = availability === "all" || p.stock_quantity > 0;
      return matchesSearch && matchesCategory && matchesPrice && matchesAvail;
    });
  }, [products, searchQuery, selectedCategory, priceRange, availability]);

  return (
    <>
      {/* Search + Filters — seamless with nav */}
      <div className="bg-card/80 backdrop-blur-md px-4 pt-3 pb-1" ref={filterRef}>
        <div className="mx-auto max-w-6xl">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-10 rounded-full border-0 bg-accent/60 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
                maxLength={100}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`h-10 w-10 rounded-full shrink-0 transition-colors ${filtersOpen || activeFilterCount > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-accent/60 hover:bg-accent"}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && !filtersOpen && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Filter Panel */}
          {filtersVisible && (
            <div
              className={`mt-3 rounded-2xl bg-accent/40 overflow-hidden transition-all duration-250 ease-out ${
                filtersOpen
                  ? "max-h-[500px] opacity-100 p-4 space-y-4"
                  : "max-h-0 opacity-0 p-0"
              }`}
            >
              {/* Category Filter */}
              {storeCategories && storeCategories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${!selectedCategory ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground hover:bg-background"}`}
                    >
                      All
                    </button>
                    {storeCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${selectedCategory === cat.name ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground hover:bg-background"}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Range */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Price Range</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPriceRange(null)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${!priceRange ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground hover:bg-background"}`}
                  >
                    Any
                  </button>
                  {priceRanges.map((pr) => (
                    <button
                      key={pr.label}
                      onClick={() => setPriceRange(priceRange?.[0] === pr.range[0] ? null : pr.range)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${priceRange?.[0] === pr.range[0] ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground hover:bg-background"}`}
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
                    onClick={() => setAvailability("all")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${availability === "all" ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground hover:bg-background"}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setAvailability(availability === "in_stock" ? "all" : "in_stock")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${availability === "in_stock" ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground hover:bg-background"}`}
                  >
                    In Stock
                  </button>
                </div>
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setSelectedCategory(null); setPriceRange(null); setAvailability("all"); }}
                  className="text-xs text-destructive hover:underline font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <StorefrontCategories
        categories={storeCategories}
        storeSlug={slug!}
        isLoading={categoriesLoading}
      />

      <div className="mx-auto max-w-6xl px-4 py-6">

        {/* Product Grid */}
        <section>
          <h2 className="mb-5 text-xl font-bold text-foreground">
            Popular Products
            {filteredProducts.length !== (products?.length || 0) && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredProducts.length} of {products?.length})
              </span>
            )}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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

        <StorefrontAbout store={store} productCount={products?.length || 0} />
      </div>
    </>
  );
}
