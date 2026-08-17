import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X, Package, SlidersHorizontal, Clock, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { useProductSearch, useDebounced } from "@/hooks/useProductSearch";
import { getRecentSearches, pushRecentSearch } from "@/lib/searchSynonyms";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type SortOption = "popular" | "price_asc" | "price_desc" | "newest";

interface StorefrontSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  products: Tables<"products">[] | undefined;
  slug: string;
  storeId?: string;
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
  { value: "price_asc", label: "Low → High" },
  { value: "price_desc", label: "High → Low" },
  { value: "newest", label: "Newest" },
];

export default function StorefrontSearchOverlay({
  open,
  onClose,
  products,
  slug,
  storeId,
  initialFiltersOpen = false,
}: StorefrontSearchOverlayProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [showFilters, setShowFilters] = useState(false);
  const [serverResults, setServerResults] = useState<Tables<"products">[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery("");
      setPriceRange(null);
      setSortBy("popular");
      setShowFilters(initialFiltersOpen);
      setServerResults(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, initialFiltersOpen]);

  const resolvedStoreId = storeId || products?.[0]?.store_id || "";

  // Ranked, typo-tolerant search via the search_products RPC (debounced).
  const debouncedQuery = useDebounced(query, 250);
  const priceFilter = priceRange
    ? { minPrice: priceRange[0] || null, maxPrice: priceRange[1] === Infinity ? null : priceRange[1] }
    : { minPrice: null, maxPrice: null };

  const { hits, isFetching } = useProductSearch(resolvedStoreId || undefined, debouncedQuery, {
    sort: sortBy === "popular" ? "relevance" : (sortBy as any),
    ...priceFilter,
  });

  useEffect(() => {
    if (!open) return;
    setServerResults(query.trim() ? (hits as any[]) : null);
    setSearching(isFetching && query.trim().length > 0);
  }, [hits, isFetching, query, open]);

  const submitSearch = useCallback((term?: string) => {
    const q = (term ?? query).trim();
    if (!q) return;
    pushRecentSearch(q);
    onClose();
    navigate(`${storefrontPath(slug, "search")}?q=${encodeURIComponent(q)}`);
  }, [query, navigate, slug, onClose]);

  const recent = open && !query.trim() ? getRecentSearches() : [];


  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const activeFilterCount = [priceRange].filter(Boolean).length;
  const hasInput = query.trim().length > 0 || activeFilterCount > 0;
  const results = serverResults || [];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[99] bg-black/30 backdrop-blur-[2px] transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
      />

      {/* Dropdown panel — centered modal on desktop */}
      <div
        ref={panelRef}
        className="fixed left-0 right-0 top-0 z-[100] animate-in slide-in-from-top-4 duration-250 ease-out md:left-1/2 md:top-[10vh] md:-translate-x-1/2 md:right-auto md:w-full md:max-w-2xl md:rounded-2xl"
        style={{
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="flex flex-col rounded-b-2xl md:rounded-2xl shadow-2xl overflow-hidden"
          style={{
            backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
            color: "var(--storefront-text, hsl(var(--foreground)))",
            maxHeight: "85vh",
          }}
        >
          {/* Search input bar */}
          <div className="flex items-center gap-2 px-3 pt-4 pb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40" />
              <Input
                ref={inputRef}
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
                enterKeyHint="search"
                className="pl-9 pr-10 rounded-full border-0 focus-visible:ring-1 focus-visible:ring-offset-0"
                style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)", color: "var(--storefront-text, hsl(var(--foreground)))" }}
                maxLength={100}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition-colors"
              style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
            >
              Cancel
            </button>
          </div>

          {/* Filter & Sort chips */}
          <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium transition-colors shrink-0"
              style={{
                backgroundColor: activeFilterCount > 0 || showFilters
                  ? "var(--storefront-text, hsl(var(--foreground)))"
                  : "var(--storefront-text, hsl(var(--foreground)))10",
                color: activeFilterCount > 0 || showFilters
                  ? "var(--storefront-bg, hsl(var(--background)))"
                  : "var(--storefront-text, hsl(var(--foreground)))",
              }}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
                  style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className="rounded-full px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: sortBy === opt.value
                    ? "var(--storefront-text, hsl(var(--foreground)))"
                    : "var(--storefront-text, hsl(var(--foreground)))10",
                  color: sortBy === opt.value
                    ? "var(--storefront-bg, hsl(var(--background)))"
                    : "var(--storefront-text, hsl(var(--foreground)))",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Expandable filter panel */}
          {showFilters && (
            <div className="px-4 py-3 space-y-3 border-t animate-in slide-in-from-top-2 duration-200"
              style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))10" }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 opacity-50">Price Range</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPriceRange(null)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                    style={{
                      backgroundColor: !priceRange
                        ? "var(--storefront-text, hsl(var(--foreground)))"
                        : "var(--storefront-text, hsl(var(--foreground)))10",
                      color: !priceRange
                        ? "var(--storefront-bg, hsl(var(--background)))"
                        : "var(--storefront-text, hsl(var(--foreground)))",
                    }}
                  >
                    Any
                  </button>
                  {PRICE_RANGES.map((pr) => (
                    <button
                      key={pr.label}
                      onClick={() => setPriceRange(pr.range)}
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: priceRange?.[0] === pr.range[0]
                          ? "var(--storefront-text, hsl(var(--foreground)))"
                          : "var(--storefront-text, hsl(var(--foreground)))10",
                        color: priceRange?.[0] === pr.range[0]
                          ? "var(--storefront-bg, hsl(var(--background)))"
                          : "var(--storefront-text, hsl(var(--foreground)))",
                      }}
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setPriceRange(null)}
                  className="text-[11px] font-medium opacity-60 hover:opacity-100"
                  style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Results */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: "55vh" }}>
            {searching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin opacity-40" />
              </div>
            ) : hasInput ? (
              results.length > 0 ? (
                <div className="px-3 py-2">
                  <p className="text-[11px] opacity-50 mb-1.5 font-medium">
                    {results.length} result{results.length !== 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                    {results.map((p) => {
                      const onSale = p.sale_price && p.sale_price < p.price;
                      const off = onSale
                        ? Math.round(((Number(p.price) - Number(p.sale_price)) / Number(p.price)) * 100)
                        : 0;
                      const soldOut = (p.stock_quantity ?? 0) <= 0;
                      return (
                        <Link
                          key={p.id}
                          to={storefrontPath(slug, `product/${p.slug || p.id}`)}
                          onClick={onClose}
                          className="group overflow-hidden rounded-xl transition-transform active:scale-[0.98]"
                          style={{
                            border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 3%, transparent)",
                          }}
                        >
                          <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4/5" }}>
                            {p.image_url ? (
                              <img
                                src={optimizeImageUrl(p.image_url, 400)}
                                alt={p.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-6 w-6 opacity-30" />
                              </div>
                            )}
                            {off > 0 && (
                              <span
                                className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                                style={{
                                  backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                                  color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                                }}
                              >
                                {off}% OFF
                              </span>
                            )}
                            {soldOut && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[10px] font-bold uppercase tracking-wide text-white">
                                Sold out
                              </span>
                            )}
                          </div>
                          <div className="px-2 pb-2 pt-1.5">
                            <p className="line-clamp-2 text-[12px] font-medium leading-snug">{p.name}</p>
                            {p.category && (
                              <p className="mt-0.5 truncate text-[10px] opacity-50">{p.category}</p>
                            )}
                            <p className="mt-1 text-[12px]">
                              {onSale ? (
                                <>
                                  <span className="font-bold">₹{Number(p.sale_price).toFixed(0)}</span>
                                  <span className="ml-1 line-through opacity-40">₹{Number(p.price).toFixed(0)}</span>
                                </>
                              ) : (
                                <span className="font-bold">₹{Number(p.price).toFixed(0)}</span>
                              )}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {query.trim() && (
                    <button
                      onClick={() => submitSearch()}
                      className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold"
                      style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 6%, transparent)" }}
                    >
                      <span>See all results for “{query.trim()}”</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center opacity-70">
                  <Package className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">No products found</p>
                  <p className="text-xs mt-1 opacity-60">Check the spelling or try a shorter word</p>
                  {query.trim() && (
                    <button
                      onClick={() => submitSearch()}
                      className="mt-3 rounded-full px-4 py-2 text-xs font-semibold"
                      style={{ backgroundColor: "var(--storefront-text, hsl(var(--foreground)))", color: "var(--storefront-bg, hsl(var(--background)))" }}
                    >
                      Open search page
                    </button>
                  )}
                </div>
              )
            ) : recent.length > 0 ? (
              <div className="px-3 py-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-50">
                  Recent searches
                </p>
                <ul className="space-y-0.5">
                  {recent.map((term) => (
                    <li key={term}>
                      <button
                        onClick={() => submitSearch(term)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left text-sm"
                      >
                        <Clock className="h-3.5 w-3.5 opacity-40" />
                        <span className="truncate">{term}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 opacity-30">
                <Search className="h-8 w-8 mb-2" />
                <p className="text-sm font-medium">Search for products</p>
                <p className="text-xs mt-1">Type a name or category</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
