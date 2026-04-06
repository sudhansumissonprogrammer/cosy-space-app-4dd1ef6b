/**
 * Theme 17 Home — "Luxe Mobile" premium storefront with glassmorphism hero,
 * pill categories, wave dividers, trending strip, and style-5 product cards.
 */
import { useState, useMemo, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";
import { optimizeImageUrl, splitImageUrls } from "@/lib/imageOptimize";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));
import StorefrontTrustStrip from "@/components/storefront/StorefrontTrustStrip";

const ABOVE_FOLD_COUNT = 6;

/* ── Wave SVG Divider ── */
function WaveDivider({ color = "var(--storefront-bg, #FAFAF8)", flip = false }: { color?: string; flip?: boolean }) {
  return (
    <div className={`w-full overflow-hidden leading-none ${flip ? "rotate-180" : ""}`} style={{ marginTop: "-1px" }}>
      <svg viewBox="0 0 1200 80" preserveAspectRatio="none" className="block w-full h-10 sm:h-16">
        <path
          d="M0,40 C200,80 400,0 600,40 C800,80 1000,0 1200,40 L1200,80 L0,80 Z"
          fill={color}
        />
      </svg>
    </div>
  );
}

/* ── Glassmorphism Hero Section ── */
function GlassmorphismHero({ store }: { store: StoreData }) {
  const mobileHeroImages = (() => {
    try {
      const imgs = store.mobile_hero_images as any;
      if (Array.isArray(imgs) && imgs.length > 0) return imgs.map((i: any) => i.url || i).filter(Boolean);
    } catch {}
    return store.mobile_hero_url ? [store.mobile_hero_url] : [];
  })();

  const desktopBanner = store.banner_url;
  const hasMobileHero = mobileHeroImages.length > 0;
  const hasDesktopBanner = !!desktopBanner;

  if (!hasMobileHero && !hasDesktopBanner) {
    // Fallback: gradient hero with store name
    return (
      <section className="relative overflow-hidden" style={{ minHeight: "380px" }}>
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, var(--storefront-primary, #1B1B3A) 0%, var(--storefront-accent, #F56E0F) 100%)`,
          }}
        />
        <div className="relative flex h-full min-h-[380px] items-end px-5 pb-10">
          <div
            className="rounded-2xl px-6 py-4"
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Alegreya SC', serif" }}
            >
              {store.name}
            </h1>
            {store.description && (
              <p className="mt-1 text-sm text-white/80 line-clamp-2" style={{ fontFamily: "var(--storefront-body-font, Inter)" }}>
                {store.description}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative">
      {/* Mobile hero */}
      {hasMobileHero && (
        <div className="block sm:hidden">
          <StorefrontMobileHero store={store} />
        </div>
      )}
      {/* Desktop banner */}
      {hasDesktopBanner && (
        <div className={hasMobileHero ? "hidden sm:block" : ""}>
          <HeroBannerCarousel store={store} />
        </div>
      )}
      {/* Floating store badge */}
      <div className="absolute bottom-4 left-4 z-10 sm:bottom-6 sm:left-6">
        <div
          className="rounded-xl px-4 py-2.5"
          style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
          <span className="text-base font-bold text-white" style={{ fontFamily: "'Alegreya SC', serif", textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            {store.name}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ── Pill Categories Scroller ── */
function PillCategories({ storeId, slug }: { storeId: string; slug: string }) {
  const { data: categories } = useQuery({
    queryKey: ["storefront-categories", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug, image_url")
        .eq("store_id", storeId)
        .order("display_order", { ascending: true });
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  if (!categories?.length) return null;

  return (
    <section className="py-6 px-4">
      <h2
        className="mb-4 text-lg font-bold"
        style={{
          fontFamily: "'Alegreya SC', serif",
          color: "var(--storefront-text, #1a1a1a)",
        }}
      >
        Browse Categories
      </h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {categories.map((cat, i) => {
          const gradients = [
            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
            "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
          ];
          return (
            <Link
              key={cat.id}
              to={storefrontPath(slug, `category/${cat.slug}`)}
              className="flex shrink-0 items-center gap-2.5 rounded-full px-5 py-2.5 text-white shadow-md transition-transform duration-300 active:scale-95"
              style={{ background: gradients[i % gradients.length] }}
            >
              {cat.image_url && (
                <img
                  src={optimizeImageUrl(cat.image_url, 40)}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover border border-white/30"
                />
              )}
              <span className="whitespace-nowrap text-sm font-semibold" style={{ fontFamily: "'Alegreya SC', serif" }}>
                {cat.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── Trending Now Strip ── */
function TrendingStrip({ products, slug, store }: { products: any[]; slug: string; store: StoreData }) {
  if (!products?.length) return null;
  const items = products.slice(0, 8);
  const currency = store.currency === "USD" ? "$" : "₹";

  return (
    <section className="py-6">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "'Alegreya SC', serif", color: "var(--storefront-text)" }}>
          <Sparkles className="h-4 w-4" style={{ color: "var(--storefront-accent, #F56E0F)" }} />
          Trending Now
        </h2>
        <Link
          to={storefrontPath(slug, "shop")}
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: "var(--storefront-primary)" }}
        >
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
        {items.map((p) => {
          const imgSrc = splitImageUrls(p.image_url)[0];
          const price = p.sale_price || p.price;
          return (
            <Link
              key={p.id}
              to={storefrontPath(slug, `product/${p.slug || p.id}`)}
              className="group relative shrink-0 overflow-hidden rounded-xl"
              style={{ width: "140px", height: "140px" }}
            >
              <img
                src={imgSrc ? optimizeImageUrl(imgSrc, 300) : "/placeholder.svg"}
                alt={p.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-semibold text-white line-clamp-1" style={{ fontFamily: "'Alegreya SC', serif" }}>{p.name}</p>
                <p className="text-[11px] font-bold text-white/90">{currency}{price.toLocaleString("en-IN")}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── Main Home Component ── */
export default function StorefrontHomeV17() {
  const { store, slug } = useOutletContext<{ store: StoreData; slug: string }>();
  const themeConfig = useStorefrontThemeConfig(store?.id);
  const cardStyle = (themeConfig as any)?.product_card_style || "style-5";

  // JSON-LD
  useStoreJsonLd(store);

  // Products
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useStorefrontProducts(store?.id);

  const products = useMemo(
    () => productsData?.pages?.flatMap((p) => p.items) || [],
    [productsData]
  );

  // Best sellers
  const { data: bestSellers = [] } = useBestSellingProducts(store?.id);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // All product IDs for variant count provider
  const allProductIds = useMemo(() => {
    const ids = products.map((p) => p.id);
    bestSellers.forEach((p: any) => { if (!ids.includes(p.id)) ids.push(p.id); });
    return ids;
  }, [products, bestSellers]);

  // Content ready event
  useEffect(() => {
    if (products.length > 0) {
      window.dispatchEvent(new CustomEvent("storefront:content-ready"));
    }
  }, [products.length]);

  if (!store) return null;

  return (
    <VariantCountProvider productIds={allProductIds} storeId={store.id}>
      {/* 1. Glassmorphism Hero */}
      <GlassmorphismHero store={store} />

      {/* 2. Pill Categories */}
      <PillCategories storeId={store.id} slug={slug} />

      {/* 3. Best Sellers with wave divider */}
      {bestSellers.length > 0 && (
        <div>
          <WaveDivider color="var(--storefront-primary, #1B1B3A)" />
          <section
            className="py-8 px-4"
            style={{ background: "var(--storefront-primary, #1B1B3A)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Alegreya SC', serif" }}>
                Best Sellers
              </h2>
              <Link
                to={storefrontPath(slug, "best-sellers")}
                className="flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white"
              >
                See All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Featured first item large + grid below */}
            <div className="space-y-4">
              {/* Large featured card */}
              <div className="overflow-hidden rounded-2xl" style={{ aspectRatio: "16/10" }}>
                <Link
                  to={storefrontPath(slug, `product/${bestSellers[0]?.slug || bestSellers[0]?.id}`)}
                  className="group relative block h-full"
                >
                  <img
                    src={splitImageUrls(bestSellers[0]?.image_url)[0] ? optimizeImageUrl(splitImageUrls(bestSellers[0]?.image_url)[0], 600) : "/placeholder.svg"}
                    alt={bestSellers[0]?.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Alegreya SC', serif" }}>
                      {bestSellers[0]?.name}
                    </h3>
                    <p className="text-sm font-semibold text-white/90">
                      {store.currency === "USD" ? "$" : "₹"}
                      {(bestSellers[0]?.sale_price || bestSellers[0]?.price || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </Link>
              </div>

              {/* 2-col grid for rest */}
              {bestSellers.length > 1 && (
                <div className="grid grid-cols-2 gap-3">
                  {bestSellers.slice(1, 5).map((p: any) => (
                    <UniversalProductCard
                      key={p.id}
                      product={p}
                      slug={slug}
                      store={store}
                      cardStyle={cardStyle}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
          <WaveDivider color="var(--storefront-primary, #1B1B3A)" flip />
        </div>
      )}

      {/* 4. Trending Now Strip */}
      <TrendingStrip products={products.slice(0, 8)} slug={slug} store={store} />

      {/* 5. All Products Grid */}
      <section className="py-6 px-4">
        <h2
          className="mb-5 text-lg font-bold"
          style={{
            fontFamily: "'Alegreya SC', serif",
            color: "var(--storefront-text, #1a1a1a)",
          }}
        >
          All Products
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, ABOVE_FOLD_COUNT).map((p) => (
            <UniversalProductCard
              key={p.id}
              product={p}
              slug={slug}
              store={store}
              priority
              cardStyle={cardStyle}
            />
          ))}
          {products.slice(ABOVE_FOLD_COUNT).map((p) => (
            <UniversalProductCard
              key={p.id}
              product={p}
              slug={slug}
              store={store}
              cardStyle={cardStyle}
            />
          ))}
        </div>

        {/* Loading / sentinel */}
        <div ref={sentinelRef} className="py-4" />
        {isFetchingNextPage && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}
      </section>

      {/* 6. Trust Strip */}
      <LazyRender rootMargin="200px">
        <StorefrontTrustStrip />
      </LazyRender>

      {/* 7. Instagram Section */}
      <LazyRender rootMargin="200px">
        <Suspense fallback={null}>
          <StorefrontInstagramSection store={store} />
        </Suspense>
      </LazyRender>

      {/* Bottom padding for mobile nav */}
      <div className="h-24 sm:hidden" />
    </VariantCountProvider>
  );
}
