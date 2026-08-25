import { useOutletContext, useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import { storefrontPath } from "@/lib/subdomain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProductListJsonLd } from "@/hooks/useJsonLd";
import { useCanonical } from "@/hooks/useCanonical";
import { getStoreBaseUrl } from "@/lib/storeUrl";
import { useInfiniteProducts, PAGE_SIZE } from "@/hooks/useInfiniteProducts";
import ShopFilterBar, { applySort, type SortKey } from "@/components/storefront/ShopFilterBar";
import CategoryHeroBanner from "@/components/storefront/CategoryHeroBanner";
import ShopEmptyState from "@/components/storefront/ShopEmptyState";
import BackToTop from "@/components/storefront/BackToTop";
import { fetchCategoryEdge, CATEGORY_PAGE_LIMIT } from "@/lib/storefrontEdgeApi";
import { categoryPrefetchCache, categoryPrefetchResolved } from "@/lib/prefetchCategory";
import CategoryQuickJump from "@/components/storefront/CategoryQuickJump";
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { fireMetaCAPI } from "@/lib/metaCapi";
import { hidesCategoryFilters } from "@/components/storefront/pdp/storeSections/config";

/**
 * The edge/RPC category payload returns up to CATEGORY_PAGE_LIMIT (50) products,
 * but the infinite query paginates in PAGE_SIZE (20) chunks to match the Worker
 * /api/products offsets. Seeding one 50-item page broke `hasNextPage`
 * (50 !== 20 → pagination stopped dead at 50 items). So we split the payload
 * into whole 20-item pages and drop the remainder — the next fetch resumes at
 * the correct offset.
 */
function seedInfinitePages(products: any[]) {
  const pages: { products: any[]; page: number }[] = [];
  const pageParams: number[] = [];
  const full = Math.floor(products.length / PAGE_SIZE);
  const count = full > 0 ? full : 1; // keep short (<20) results as a single final page
  for (let i = 0; i < count; i++) {
    pages.push({ products: products.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE), page: i });
    pageParams.push(i);
  }
  return { pages, pageParams };
}

export default function CategoryDetail() {
  const store = useOutletContext<StoreData>();
  const { slug, categorySlug } = useParams<{ slug: string; categorySlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const themeConfig = useStorefrontThemeConfig(store.id);
  const storeTheme = (store as any)?.theme || "starter";
  const cardStyle = themeConfig?.product_card_style || (storeTheme === "theme-13" ? "style-4" : "style-1");
  const isMenuStyle = cardStyle === "style-4";
  useCanonical(categorySlug ? `${getStoreBaseUrl(slug || store.slug, (store as any)?.custom_domain)}/category/${categorySlug}` : null);

  // Utkal Watches / Hopknock: no category strip, no sort-filter bar.
  const hideFilters = hidesCategoryFilters({ id: store.id, slug: store.slug });

  const [sort, setSort] = useState<SortKey>("default");

  // Worker-inlined category payload (Phase A): { category, products, total }
  const getInlineCategory = () => {
    try {
      const inline = (window as any).__CATEGORY_INLINE__;
      if (inline?.category && inline.category.slug === categorySlug) return inline;
    } catch { /* ignore */ }
    return null;
  };

  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ["category", store.id, categorySlug],
    queryFn: async () => {
      // Phase A: try Worker edge cache first (KV + CF cache).
      // IMPORTANT: use CATEGORY_PAGE_LIMIT (50) — the Worker prewarms and
      // caches under the `:l50` key. Requesting `:l20` (PAGE_SIZE) always
      // MISSED the KV cache and forced a full DB roundtrip on every SPA
      // click from home → category. This alone turns 350–650 ms uncached
      // hits into instant KV HITs.
      // If the link was hovered/touched, the payload is already in flight (or
      // resolved) from prefetchCategory — await that instead of a new RTT.
      const prefetched = categoryPrefetchCache.get(categorySlug!);
      const edge = prefetched
        ? await prefetched
        : await fetchCategoryEdge(categorySlug!, CATEGORY_PAGE_LIMIT);
      const rpc = edge ?? (await (supabase as any).rpc("get_category_page", {
        _store_slug: store.slug,
        _category_slug: categorySlug!,
        _limit: PAGE_SIZE,
      })).data;

      if (rpc?.category) {
        if (Array.isArray(rpc.products)) {
          const qKey = ["cat-detail-v3", store.id, rpc.category.name, "default", PAGE_SIZE];
          queryClient.setQueryData(qKey, seedInfinitePages(rpc.products));
          // Note: this path is a FRESH Supabase RPC response — no need to
          // invalidate. (The stale-pin invalidation only matters for the
          // inline HTML payload, see initialData below.)
        }
        return rpc.category as { id: string; name: string; slug: string; image_url: string | null };
      }
      // Fallback: legacy direct lookup
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .eq("store_id", store.id)
        .eq("slug", categorySlug)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; slug: string; image_url: string | null } | null;
    },
    initialData: () => {
      // Hover/touch prefetch already resolved → hydrate synchronously, the
      // category page paints with products on its very first render.
      const pre = categorySlug ? categoryPrefetchResolved.get(categorySlug) : null;
      if (pre?.category) {
        if (Array.isArray(pre.products)) {
          queryClient.setQueryData(
            ["cat-detail-v3", store.id, pre.category.name, "default", PAGE_SIZE],
            seedInfinitePages(pre.products)
          );
        }
        return pre.category;
      }
      const inline = getInlineCategory();
      if (inline?.category) {
        if (Array.isArray(inline.products)) {
          const qKey = ["cat-detail-v3", store.id, inline.category.name, "default", PAGE_SIZE];
          queryClient.setQueryData(qKey, seedInfinitePages(inline.products));
          // PERF: the inline HTML payload can be stale, so we still refresh from
          // the version-aware /api/products endpoint — but NOT synchronously.
          // Invalidating during render queued the refetch inside the hydration
          // burst, so on 4x-throttled mobile it landed at ~4.6s and competed
          // with the render-critical chunks + hero images. Deferring it to idle
          // keeps freshness while taking it off the first-paint critical path.
          const refresh = () => queryClient.invalidateQueries({ queryKey: qKey });
          if (typeof (window as any).requestIdleCallback === "function") {
            (window as any).requestIdleCallback(refresh, { timeout: 3000 });
          } else {
            setTimeout(refresh, 1200);
          }
        }
        return inline.category;
      }
      return undefined;
    },

    // PERF: inline category comes from worker HTML that is itself version-purged
    // and max-age=300. Treating it as fresh for 60s stops React Query from
    // firing a duplicate category lookup the instant the route mounts.
    initialDataUpdatedAt: () => Date.now(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,

    enabled: !!store.id && !!store.slug && !!categorySlug,
  });


  const {
    data,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts({
    storeId: store.id,
    category: category?.name,
    // Cold-load fast path: the slug is in the URL from byte 0, so products no
    // longer wait behind the category-name lookup round trip.
    categorySlug,
    queryKeyPrefix: "cat-detail-v3",
    ready: true,
  });


  const rawProducts = data?.pages.flatMap((p) => p.products) || [];
  const products = useMemo(() => applySort(rawProducts, sort), [rawProducts, sort]);
  const totalEstimate = hasNextPage ? `${rawProducts.length}+` : rawProducts.length;

  const contentReadyRef = useRef(false);
  useEffect(() => { contentReadyRef.current = false; }, [categorySlug]);
  useEffect(() => {
    if (contentReadyRef.current || categoryLoading || productsLoading) return;
    contentReadyRef.current = true;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("storefront:content-ready"));
    });
  }, [categoryLoading, productsLoading, categorySlug]);

  useEffect(() => {
    if (!category || !store) return;
    const prevTitle = document.title;
    const count = rawProducts.length;
    document.title = `${category.name} — ${store.name} | Shop Online`;
    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute("content") || "";
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", `Browse ${count > 0 ? count + " " : ""}products in ${category.name} at ${store.name}. Fast delivery & easy returns.`);
    return () => {
      document.title = prevTitle;
      metaDesc?.setAttribute("content", prevDesc);
    };
  }, [category, store, rawProducts.length]);

  useProductListJsonLd({
    products: rawProducts,
    storeSlug: slug || store.slug,
    listName: category?.name || "Category",
    customDomain: (store as any)?.custom_domain,
  });

  // Fire Meta Pixel ViewContent + CAPI once per category visit.
  // Critical for ad-spend optimization: without ViewContent, Meta has no
  // signal of "what user is interested in" → can't optimize delivery for
  // category-targeted ads. We send first 5 product IDs and category name.
  const viewContentFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!category || !store?.id) return;
    if (rawProducts.length === 0) return;
    const key = `${store.id}:${category.slug}`;
    if (viewContentFiredRef.current === key) return;
    viewContentFiredRef.current = key;

    const topIds = rawProducts.slice(0, 5).map((p: any) => String(p.id)).filter(Boolean);
    // Never fire ViewContent with empty content_ids — Meta logs it as a
    // schema warning and the event contributes zero attribution signal.
    if (topIds.length === 0) return;
    const eventId = generateEventId();
    const categoryValue = rawProducts
      .slice(0, 5)
      .reduce((sum: number, p: any) => {
        const price = Number(p.sale_price && p.sale_price < p.price ? p.sale_price : p.price);
        return Number.isFinite(price) && price > 0 ? sum + price : sum;
      }, 0);
    const customData = {
      content_ids: topIds,
      content_name: category.name,
      content_category: category.name,
      // MUST be "product": we send raw products.id values here. Sending
      // "product_group" made Meta look these ids up as item_group_ids →
      // every category ViewContent scored as an unmatched content id.
      content_type: "product",
      ...(categoryValue > 0 ? { value: categoryValue, currency: "INR" } : {}),
    };
    try { fbPixelTrack("ViewContent", customData, eventId); } catch {}
    try {
      fireMetaCAPI({
        storeId: store.id,
        eventName: "ViewContent",
        eventId,
        customData,
      });
    } catch {}
  }, [category, store?.id, rawProducts.length]);

  const sentinelElRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((el: HTMLDivElement | null) => { sentinelElRef.current = el; }, []);

  const pageCount = data?.pages.length ?? 0;
  useEffect(() => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    const el = sentinelElRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchNextPage(); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, pageCount]);

  if (!categoryLoading && !category) {
    return (
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate(storefrontPath(slug!, ""))} className="mb-4 rounded-full bg-background text-foreground shadow-sm hover:shadow-md">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
          <p className="text-muted-foreground">Category not found</p>
        </div>
      </div>
    );
  }

  const gridClass = isMenuStyle
    ? "flex flex-col gap-2.5"
    : `grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5${cardStyle === "style-6" ? " -mx-3 sm:mx-0 gap-x-1" : ""}`;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-5">
      <h1 className="sr-only">{category?.name || "Category"} — {store.name}</h1>
      {!hideFilters && <CategoryQuickJump storeId={store.id} slug={slug!} activeCategory={categorySlug} />}

      {hideFilters ? (
        <div className="pt-0.5">
          <button
            onClick={() => navigate(storefrontPath(slug!, ""))}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-accent transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <ShopFilterBar
          total={totalEstimate || rawProducts.length}
          showing={products.length}
          sort={sort}
          onSortChange={setSort}
          leading={
            <button
              onClick={() => navigate(storefrontPath(slug!, ""))}
              aria-label="Back"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-accent transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          }
        />
      )}

      <div style={{ minHeight: 600 }} className="mt-3">
        {categoryLoading || productsLoading ? (
          <div className={gridClass}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
                <div className="px-2.5 pb-2.5 pt-2 space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : productsError && products.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border bg-card">
            <p className="text-muted-foreground">Failed to load products</p>
            <button
              onClick={() => refetchProducts()}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : products.length > 0 ? (
          <>
            <div className={gridClass}>
              {products.map((product, idx) => (
                <UniversalProductCard key={product.id} product={product} slug={slug!} store={store} priority={idx < 4} cardStyle={cardStyle} index={idx} />
              ))}
            </div>

            <div ref={sentinelRef} className="flex justify-center py-8">
              {isFetchingNextPage && (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              )}
              {!hasNextPage && rawProducts.length > PAGE_SIZE && (
                <p className="text-sm text-muted-foreground">You've seen all products</p>
              )}
            </div>
          </>
        ) : (
          <ShopEmptyState
            slug={slug!}
            title={sort === "in-stock" ? "Nothing in stock here" : "Empty category"}
            message={sort === "in-stock" ? "Try clearing the In Stock filter or explore other categories." : `No products in ${category?.name || "this category"} yet.`}
          />
        )}
      </div>

      <BackToTop />
    </div>
  );
}
