import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Zap, Tag, Clock } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
const StorefrontSearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { getDiscountPercent } from "@/lib/productUtils";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import { HomeBestSellingSection } from "@/components/storefront/HomeSharedSections";
import { Skeleton } from "@/components/ui/skeleton";
import SectionHeading from "@/components/storefront/SectionHeading";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));
const StorefrontTrustStrip = lazy(() => import("@/components/storefront/StorefrontTrustStrip"));

/* ── Swipeable Banner Slider ── */
function BannerSlider({ store }: { store: StoreData }) {
  // Mobile: only mobile_hero_images / mobile_hero_url
  const mobileSlides = useMemo(() => {
    const s: { image: string; title: string }[] = [];
    const mhi = (store as any).mobile_hero_images;
    if (mhi && Array.isArray(mhi) && mhi.length > 0) {
      mhi.forEach((url: string, idx: number) => {
        s.push({ image: url, title: idx === 0 ? store.name : "New Arrivals" });
      });
    } else if ((store as any).mobile_hero_url) {
      s.push({ image: (store as any).mobile_hero_url, title: store.name });
    }
    if (s.length === 0) {
      s.push({ image: "", title: store.name });
    }
    return s;
  }, [store]);

  // Desktop: only banner_url
  const desktopSlides = useMemo(() => {
    const s: { image: string; title: string }[] = [];
    if ((store as any).banner_url) {
      s.push({ image: (store as any).banner_url, title: store.name });
    }
    if (s.length === 0) {
      s.push({ image: "", title: store.name });
    }
    return s;
  }, [store]);

  const hasMobileSlides = mobileSlides.some(s => s.image);
  const hasDesktopSlides = desktopSlides.some(s => s.image);

  return (
    <>
      {hasMobileSlides && (
        <div className="block md:hidden">
          <BannerSliderInner slides={mobileSlides} />
        </div>
      )}
      {hasDesktopSlides && (
        <div className="hidden md:block">
          <BannerSliderInner slides={desktopSlides} />
        </div>
      )}
    </>
  );
}

function BannerSliderInner({ slides }: { slides: { image: string; title: string }[] }) {
  const [current, setCurrent] = useState(0);
  const touchStart = useRef(0);

  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % count), 2000);
    return () => clearInterval(t);
  }, [count]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setCurrent((c) => diff > 0 ? (c + 1) % count : (c - 1 + count) % count);
    }
  };

  const slide = slides[current] ?? slides[0] ?? { image: "", title: "Store", link: undefined };

  return (
    <div
      className="relative w-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {slide.image ? (
        <img
          src={optimizeImageUrl(slide.image, 800)}
          alt={slide.title}
          className="w-full h-auto block transition-opacity duration-500"
          loading="eager"
          fetchPriority="high"
          decoding="sync"
        />
      ) : (
        <div
          className="w-full aspect-[16/7]"
          style={{ background: `linear-gradient(135deg, var(--storefront-primary, #3B82F6), var(--storefront-accent, #F97316))` }}
        />
      )}
      {/* Dots */}
      {count > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === current ? "16px" : "6px",
                backgroundColor: i === current ? "var(--storefront-primary, #fff)" : "rgba(255,255,255,0.5)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Category Icon Row ── */
function CategoryIconRow({ categories, slug }: { categories: any[] | undefined; slug: string }) {
  if (!categories || categories.length === 0) return null;
  return (
    <div className="px-3 py-3">
      <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            to={storefrontPath(slug, `category/${cat.slug}`)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm transition-transform active:scale-95"
              style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))12", border: "1px solid var(--storefront-primary, hsl(var(--primary)))20" }}
            >
              {cat.image_url ? (
                <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Tag className="h-6 w-6" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }} />
              )}
            </div>
            <span className="text-[10px] font-semibold text-center leading-tight w-14 line-clamp-1">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Flash Deals Section ── */
function FlashDeals({ products, slug, store }: { products: any[]; slug: string; store: StoreData }) {
  const deals = useMemo(() => {
    return products.filter((p) => p.sale_price && p.sale_price < p.price).slice(0, 8);
  }, [products]);

  const [timeLeft, setTimeLeft] = useState({ h: 5, m: 42, s: 18 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; m = 59; s = 59; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (deals.length === 0) return null;

  return (
    <div className="px-3 py-3">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}
          >
            <Zap className="h-4 w-4" style={{ color: "var(--storefront-btn-text, #fff)" }} />
          </div>
          <h3 className="text-sm font-bold" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>Flash Deals</h3>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }} />
          <div className="flex gap-0.5">
            {[
              String(timeLeft.h).padStart(2, "0"),
              String(timeLeft.m).padStart(2, "0"),
              String(timeLeft.s).padStart(2, "0"),
            ].map((t, i) => (
              <span key={i} className="flex items-center">
                <span
                  className="rounded px-1 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, #fff)" }}
                >
                  {t}
                </span>
                {i < 2 && <span className="text-[10px] font-bold mx-0.5" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>:</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {deals.map((product) => {
          const discount = getDiscountPercent(product.price, product.sale_price);
          return (
            <Link
              key={product.id}
              to={storefrontPath(slug, `product/${product.slug || product.id}`)}
              className="flex-shrink-0 w-32 overflow-hidden rounded-2xl border transition-transform active:scale-[0.97]"
              style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))10" }}
            >
              <div className="relative" style={{ aspectRatio: "1/1" }}>
                {product.image_url ? (
                  <img
                    src={optimizeImageUrl(product.image_url, 300)}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))08" }}>
                    <Tag className="h-6 w-6" style={{ color: "var(--storefront-text, hsl(var(--foreground)))20" }} />
                  </div>
                )}
                <span
                  className="absolute top-1.5 left-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, #fff)" }}
                >
                  {discount}% OFF
                </span>
              </div>
              <div className="p-2 space-y-0.5">
                <p className="text-[10px] font-semibold line-clamp-1">{product.name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-extrabold">₹{Number(product.sale_price).toFixed(0)}</span>
                  <span className="text-[9px] line-through opacity-50">₹{Number(product.price).toFixed(0)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function StorefrontHomeV3() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const [sortOpen, setSortOpen] = useState(false);

  useStoreJsonLd({
    storeName: store.name,
    storeSlug: store.slug,
    description: store.description,
    logo: store.logo_url,
    location: store.location,
    whatsappNumber: store.whatsapp_number,
    customDomain: (store as any)?.custom_domain,
  });

  const { products, isLoading: isProductsLoading } = useStorefrontProducts(store.id);
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const themeConfig = useStorefrontThemeConfig(store.id);
  const cardStyle = themeConfig?.product_card_style || "style-1";

  const allSorted = useMemo(() => {
    if (!products) return [];
    const sorted = [...products];
    switch (sortBy) {
      case "price_asc": sorted.sort((a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price)); break;
      case "price_desc": sorted.sort((a, b) => (b.sale_price ?? b.price) - (a.sale_price ?? a.price)); break;
      case "newest": sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    }
    return sorted;
  }, [products, sortBy]);

  return (
    <>
      {/* Banner Slider */}
      <BannerSlider store={store} />

      {/* Categories */}
      <UniversalCategories
        categories={storeCategories}
        storeSlug={slug!}
        isLoading={!storeCategories}
        categoryStyle={themeConfig?.category_style || "style-1"}
      />
      {/* Best Sellers */}
      {products && (
        <HomeBestSellingSection products={products} slug={slug!} store={store} cardStyle={cardStyle} />
      )}

      {/* Flash Deals */}
      {products && <FlashDeals products={products} slug={slug!} store={store} />}

      {/* Search overlay */}
      {searchOpen && (
        <Suspense fallback={null}>
          <StorefrontSearchOverlay
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            products={products}
            slug={slug!}
            storeId={store.id}
            initialFiltersOpen={false}
          />
        </Suspense>
      )}

      {/* Product Grid */}
      <div className="px-3 pb-6 space-y-3" style={{ minHeight: 560, contain: "layout style" }}>
        {/* Sort header */}
        <div className="flex items-center justify-between">
          <SectionHeading title="All Products" />
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
              style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))15" }}
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortBy === "popular" && "Popular"}
              {sortBy === "price_asc" && "Low"}
              {sortBy === "price_desc" && "High"}
              {sortBy === "newest" && "New"}
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-xl border bg-popover shadow-lg">
                {([
                  { value: "popular", label: "Popular" },
                  { value: "price_asc", label: "Price: Low → High" },
                  { value: "price_desc", label: "Price: High → Low" },
                  { value: "newest", label: "Newest First" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className={`block w-full px-3 py-2 text-left text-xs ${sortBy === opt.value ? "font-bold" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        {isProductsLoading ? (
          <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" style={{ minHeight: 520 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="rounded-2xl" style={{ aspectRatio: "4/5" }} />
            ))}
          </div>
        ) : allSorted.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {allSorted.slice(0, 10).map((product, idx) => (
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
            {allSorted.length > 10 && (
              <LazyRender rootMargin="400px" minHeight={400}>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {allSorted.slice(10).map((product) => (
                    <UniversalProductCard
                      key={product.id}
                      product={product}
                      slug={slug!}
                      store={store}
                      cardStyle={cardStyle}
                    />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border bg-card">
            <p className="text-muted-foreground">No products available yet.</p>
          </div>
        )}
      </div>
      <Suspense fallback={null}>
        <StorefrontTrustStrip storeId={store.id} currency={store.currency} />
      </Suspense>
      <Suspense fallback={null}>
        <StorefrontInstagramSection store={store} />
      </Suspense>
    </>
  );
}
