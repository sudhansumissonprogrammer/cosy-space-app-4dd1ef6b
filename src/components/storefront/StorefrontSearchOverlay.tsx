import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, X, Package, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { supabase } from "@/integrations/supabase/client";
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

  // Server-side search with debounce
  const searchServer = useCallback(async (q: string, price: [number, number] | null, sort: SortOption) => {
    if (!resolvedStoreId) return;
    setSearching(true);
    try {
      let qb = supabase
        .from("products")
        .select("id, name, slug, price, sale_price, image_url, category, created_at, is_best_selling")
        .eq("store_id", resolvedStoreId)
        .eq("is_active", true);

      if (q.trim()) {
        qb = qb.or(`name.ilike.%${q.trim()}%,category.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
      }

      if (price) {
        qb = qb.gte("price", price[0]);
        if (price[1] !== Infinity) {
          qb = qb.lt("price", price[1]);
        }
      }

      switch (sort) {
        case "price_asc":
          qb = qb.order("price", { ascending: true });
          break;
        case "price_desc":
          qb = qb.order("price", { ascending: false });
          break;
        case "newest":
          qb = qb.order("created_at", { ascending: false });
          break;
        default:
          qb = qb.order("is_best_selling", { ascending: false }).order("created_at", { ascending: false });
      }

      const { data } = await qb.limit(30);
      setServerResults((data as Tables<"products">[]) || []);
    } finally {
      setSearching(false);
    }
  }, [resolvedStoreId]);

  // Debounced search trigger
  useEffect(() => {
    if (!open) return;
    const hasInput = query.trim().length > 0 || priceRange !== null;
    if (!hasInput) {
      setServerResults(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchServer(query, priceRange, sortBy);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, priceRange, sortBy, open, searchServer]);

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
                className="pl-9 pr-10 rounded-full border-0 bg-accent/60 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
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
              className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold hover:bg-accent transition-colors"
              style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
            >
              Cancel
            </button>
          </div>

          {/* Filter & Sort chips */}
          <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors shrink-0"
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
                  style={{ backgroundColor: "#EF4444", color: "#fff" }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className="rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0"
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
                  style={{ color: "#EF4444" }}
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
                  <ul className="space-y-0.5">
                    {results.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={storefrontPath(slug, `product/${p.slug || p.id}`)}
                          onClick={onClose}
                          className="flex items-center gap-3 px-2 py-2 rounded-xl transition-colors"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--storefront-text, hsl(var(--foreground)))06"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        >
                          {p.image_url ? (
                            <img
                              src={optimizeImageUrl(p.image_url, 96)}
                              alt={p.name}
                              className="h-11 w-11 rounded-lg object-cover flex-shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg flex-shrink-0"
                              style={{ backgroundColor: "var(--storefront-text, hsl(var(--foreground)))08" }}
                            >
                              <Package className="h-5 w-5 opacity-30" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            {p.category && (
                              <p className="text-[11px] opacity-50 truncate">{p.category}</p>
                            )}
                            <p className="text-xs mt-0.5">
                              {p.sale_price && p.sale_price < p.price ? (
                                <>
                                  <span className="font-semibold">₹{Number(p.sale_price).toFixed(0)}</span>
                                  <span className="ml-1 line-through opacity-40">₹{Number(p.price).toFixed(0)}</span>
                                </>
                              ) : (
                                <span className="font-semibold">₹{Number(p.price).toFixed(0)}</span>
                              )}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-40">
                  <Package className="h-8 w-8 mb-2" />
                  <p className="text-sm font-medium">No products found</p>
                  <p className="text-xs mt-1">Try a different search</p>
                </div>
              )
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
