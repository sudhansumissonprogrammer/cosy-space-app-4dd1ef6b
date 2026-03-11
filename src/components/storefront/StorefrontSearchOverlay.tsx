import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, X, Package, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import type { Tables } from "@/integrations/supabase/types";

type SortOption = "popular" | "price_asc" | "price_desc" | "newest";

interface StorefrontSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  products: Tables<"products">[] | undefined;
  slug: string;
  initialFiltersOpen?: boolean;
}

const PRICE_RANGES: { label: string; range: [number, number] }[] = [
  { label: "Under ₹500", range: [0, 500] },
  { label: "₹500 – ₹1000", range: [500, 1000] },
  { label: "₹1000 – ₹2000", range: [1000, 2000] },
  { label: "₹2000+", range: [2000, Infinity] },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest First" },
];

export default function StorefrontSearchOverlay({
  open,
  onClose,
  products,
  slug,
  initialFiltersOpen = false,
}: StorefrontSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setPriceRange(null);
      setSortBy("popular");
      setShowFilters(initialFiltersOpen);
      if (!initialFiltersOpen) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [open, initialFiltersOpen]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const activeFilterCount = [priceRange].filter(Boolean).length;

  const results = useMemo(() => {
    if (!products) return [];
    let filtered = products.filter((p) => {
      const q = query.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q);
      const effectivePrice = p.sale_price ?? p.price;
      const matchesPrice =
        !priceRange || (effectivePrice >= priceRange[0] && effectivePrice < priceRange[1]);
      return matchesSearch && matchesPrice;
    });

    switch (sortBy) {
      case "price_asc":
        filtered.sort((a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price));
        break;
      case "price_desc":
        filtered.sort((a, b) => (b.sale_price ?? b.price) - (a.sale_price ?? a.price));
        break;
      case "newest":
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return filtered;
  }, [products, query, priceRange, sortBy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border bg-card">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-10 rounded-full border-0 bg-accent/60 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
            maxLength={100}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-primary hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Filter & Sort chips */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card/80 border-b border-border overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
            activeFilterCount > 0 || showFilters
              ? "bg-foreground text-background"
              : "bg-accent/60 text-foreground hover:bg-accent"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              sortBy === opt.value
                ? "bg-foreground text-background"
                : "bg-accent/60 text-foreground hover:bg-accent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="px-4 py-3 space-y-4 bg-card border-b border-border animate-in slide-in-from-top-2 duration-200">
          {/* Price Range */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Price Range
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPriceRange(null)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  !priceRange ? "bg-foreground text-background" : "bg-accent text-foreground hover:bg-accent/80"
                }`}
              >
                Any
              </button>
              {PRICE_RANGES.map((pr) => (
                <button
                  key={pr.label}
                  onClick={() => setPriceRange(pr.range)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    priceRange?.[0] === pr.range[0]
                      ? "bg-foreground text-background"
                      : "bg-accent text-foreground hover:bg-accent/80"
                  }`}
                >
                  {pr.label}
                </button>
              ))}
            </div>
          </div>


          {activeFilterCount > 0 && (
            <button
              onClick={() => { setPriceRange(null); }}
              className="text-xs text-destructive hover:underline font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {query.trim() || activeFilterCount > 0 ? (
          results.length > 0 ? (
            <div className="px-3 py-2">
              <p className="text-[11px] text-muted-foreground mb-2 font-medium">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              <ul className="space-y-0.5">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={storefrontPath(slug, `product/${p.slug || p.id}`)}
                      onClick={onClose}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-accent/60 transition-colors"
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/40 flex-shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        {p.category && (
                          <p className="text-[11px] text-muted-foreground truncate">{p.category}</p>
                        )}
                        <p className="text-xs mt-0.5">
                          {p.sale_price && p.sale_price < p.price ? (
                            <>
                              <span className="font-semibold text-foreground">
                                ₹{Number(p.sale_price).toFixed(0)}
                              </span>
                              <span className="ml-1 line-through text-muted-foreground">
                                ₹{Number(p.price).toFixed(0)}
                              </span>
                            </>
                          ) : (
                            <span className="font-semibold text-foreground">
                              ₹{Number(p.price).toFixed(0)}
                            </span>
                          )}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No products found</p>
              <p className="text-xs mt-1">Try a different search or filter</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Search for products</p>
            <p className="text-xs mt-1">Type a name, category, or description</p>
          </div>
        )}
      </div>
    </div>
  );
}
