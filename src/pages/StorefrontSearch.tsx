import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, SearchX, SlidersHorizontal, X } from "lucide-react";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useProductSearch, SEARCH_PAGE_SIZE, type SearchSort } from "@/hooks/useProductSearch";
import { didYouMean, pushRecentSearch } from "@/lib/searchSynonyms";
import { storefrontPath } from "@/lib/subdomain";
import { fireStorefrontEvent } from "@/lib/storefrontEvents";
import type { StoreData } from "@/layouts/StorefrontLayout";

const SORTS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest" },
];

const PRICE_BUCKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under ₹500", min: null, max: 500 },
  { label: "₹500 – ₹1000", min: 500, max: 1000 },
  { label: "₹1000 – ₹2000", min: 1000, max: 2000 },
  { label: "₹2000+", min: 2000, max: null },
];

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
      <div className="px-2.5 pb-2.5 pt-2 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function StorefrontSearch() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";

  const themeConfig = useStorefrontThemeConfig(store.id);
  const cardStyle = themeConfig?.product_card_style || "style-1";
  const isMenuStyle = cardStyle === "style-menu";
  const gridClass = isMenuStyle
    ? "flex flex-col gap-2.5"
    : "grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5";

  const [sort, setSort] = useState<SearchSort>("relevance");
  const [bucket, setBucket] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Reset filters when the query changes
  useEffect(() => {
    setBucket(null);
    setCategory(null);
    setInStockOnly(false);
    setSort("relevance");
  }, [query]);

  const price = bucket !== null ? PRICE_BUCKETS[bucket] : null;

  const {
    hits,
    total,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProductSearch(store.id, query, {
    sort,
    minPrice: price?.min ?? null,
    maxPrice: price?.max ?? null,
    category,
  });

  const products = useMemo(
    () => (inStockOnly ? hits.filter((h) => (h.stock_quantity ?? 0) > 0) : hits),
    [hits, inStockOnly]
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    hits.forEach((h) => {
      if (h.category) counts.set(h.category, (counts.get(h.category) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [hits]);

  const suggestion = useMemo(() => didYouMean(query), [query]);

  // The shell owns this noindex utility route's query-free canonical.

  // Remember + report the search once results settle
  const reported = useRef<string>("");
  useEffect(() => {
    if (!query || isLoading || reported.current === query) return;
    reported.current = query;
    pushRecentSearch(query);
    fireStorefrontEvent({
      storeId: store.id,
      eventName: total === 0 ? "search_no_results" : "search_performed",
      metadata: { query: query.slice(0, 100), results: total, source: "search_page" },
    });
    window.dispatchEvent(new Event("storefront:content-ready"));
  }, [query, isLoading, total, store.id]);

  // Infinite scroll
  const sentinelElRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    sentinelElRef.current = el;
  }, []);
  useEffect(() => {
    observerRef.current?.disconnect();
    const el = sentinelElRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchNextPage(); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, products.length]);

  const activeFilters = (bucket !== null ? 1 : 0) + (category ? 1 : 0) + (inStockOnly ? 1 : 0);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-5">
      <div className="mb-3 flex items-center gap-3">
        <Link
          to={storefrontPath(slug!, "")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-accent transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
            Showing results for “{query}”
          </h1>
          {!isLoading && (
            <p className="text-xs text-muted-foreground">
              {total} product{total === 1 ? "" : "s"} found
            </p>
          )}
        </div>
      </div>

      {suggestion && (
        <p className="mb-3 text-sm text-muted-foreground">
          Did you mean{" "}
          <button
            className="font-semibold text-foreground underline underline-offset-2"
            onClick={() => setSearchParams({ q: suggestion })}
          >
            {suggestion}
          </button>
          ?
        </p>
      )}

      {/* Sort + filter bar */}
      <div className="sticky top-0 z-20 -mx-3 mb-3 flex items-center gap-1.5 overflow-x-auto bg-background/95 px-3 py-2 backdrop-blur scrollbar-hide sm:-mx-4 sm:px-4">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilters > 0 && (
            <span className="rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background">
              {activeFilters}
            </span>
          )}
        </button>
        {SORTS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSort(s.value)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              sort === s.value
                ? "bg-foreground text-background"
                : "border border-border text-foreground hover:bg-accent"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="mb-4 space-y-3 rounded-2xl border border-border bg-card p-3">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Price
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRICE_BUCKETS.map((b, i) => (
                <button
                  key={b.label}
                  onClick={() => setBucket(bucket === i ? null : i)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    bucket === i ? "bg-foreground text-background" : "border border-border"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {categories.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(category === cat ? null : cat)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      category === cat ? "bg-foreground text-background" : "border border-border"
                    }`}
                  >
                    {cat} <span className="opacity-50">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-current"
            />
            In stock only
          </label>

          {activeFilters > 0 && (
            <button
              onClick={() => { setBucket(null); setCategory(null); setInStockOnly(false); }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear all filters
            </button>
          )}
        </div>
      )}

      <div style={{ minHeight: 500 }}>
        {isLoading ? (
          <div className={gridClass}>
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border bg-card">
            <p className="text-muted-foreground">Search failed</p>
            <button
              onClick={() => refetch()}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Retry
            </button>
          </div>
        ) : products.length > 0 ? (
          <>
            <div className={gridClass}>
              {products.map((product, index) => (
                <UniversalProductCard
                  key={product.id}
                  product={product as any}
                  slug={slug!}
                  store={store}
                  priority={index < 4}
                  cardStyle={cardStyle}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="flex justify-center py-8">
              {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
              {!hasNextPage && products.length > SEARCH_PAGE_SIZE && (
                <p className="text-sm text-muted-foreground">You've seen all results</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground" />
            <p className="font-semibold text-foreground">No results for “{query}”</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try a shorter word, check the spelling, or browse the full catalogue.
            </p>
            <Link
              to={storefrontPath(slug!, "shop")}
              className="mt-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
            >
              Browse all products
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
