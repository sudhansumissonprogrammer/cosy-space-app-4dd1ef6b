import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { Search, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
const StorefrontSearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));
const StorefrontTrustStrip = lazy(() => import("@/components/storefront/StorefrontTrustStrip"));

/* ── Hero Carousel ── */
function HeroCarousel({ store }: { store: StoreData }) {
  const { products } = useStorefrontProducts(store.id);
  const [current, setCurrent] = useState(0);

  // Desktop slides: only use banner_url + best-selling products
  const desktopSlides = useMemo(() => {
    const s: { image: string; title: string; subtitle: string; link?: string }[] = [];
    if ((store as any).banner_url) {
      s.push({ image: (store as any).banner_url, title: store.name, subtitle: store.description || "Discover our collection" });
    }
    const bestSelling = products?.filter((p: any) => p.is_best_selling && p.image_url).slice(0, 3) || [];
    bestSelling.forEach((p: any) => {
      s.push({ image: p.image_url, title: p.name, subtitle: `₹${p.sale_price || p.price}`, link: storefrontPath(store.slug, `product/${p.slug || p.id}`) });
    });
    if (s.length === 0) {
      s.push({ image: "", title: store.name, subtitle: store.description || "Explore our collection" });
    }
    return s;
  }, [store, products]);

  // Mobile slides: only use mobile_hero_images / mobile_hero_url
  const mobileSlides = useMemo(() => {
    const s: { image: string; title: string; subtitle: string; link?: string }[] = [];
    const mhi = (store as any).mobile_hero_images;
    if (mhi && Array.isArray(mhi) && mhi.length > 0) {
      mhi.forEach((url: string, idx: number) => {
        s.push({ image: url, title: idx === 0 ? store.name : "New Arrivals", subtitle: idx === 0 ? (store.description || "Discover our collection") : "Shop the latest trends" });
      });
    } else if ((store as any).mobile_hero_url) {
      s.push({ image: (store as any).mobile_hero_url, title: store.name, subtitle: store.description || "Discover our collection" });
    }
    if (s.length === 0) {
      s.push({ image: "", title: store.name, subtitle: store.description || "Explore our collection" });
    }
    return s;
  }, [store]);

  const hasMobileSlides = mobileSlides.some(s => s.image);
  const hasDesktopSlides = desktopSlides.some(s => s.image);

  return (
    <>
      {hasMobileSlides && (
        <div className="block md:hidden">
          <HeroSlides slides={mobileSlides} store={store} />
        </div>
      )}
      {hasDesktopSlides && (
        <div className="hidden md:block">
          <HeroSlides slides={desktopSlides} store={store} />
        </div>
      )}
    </>
  );
}

function HeroSlides({ slides, store }: { slides: { image: string; title: string; subtitle: string; link?: string }[]; store: StoreData }) {
  const [current, setCurrent] = useState(0);

  const slideCount = slides.length;

  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slideCount), 2000);
    return () => clearInterval(timer);
  }, [slideCount]);

  const prev = () => setCurrent((c) => (c - 1 + slideCount) % slideCount);
  const next = () => setCurrent((c) => (c + 1) % slideCount);

  const slide = slides[current] ?? slides[0] ?? { image: "", title: store.name, subtitle: store.description || "" };

  return (
    <div className="relative w-full overflow-hidden h-[60vh] sm:h-[85vh]" style={{ minHeight: "350px", maxHeight: "800px" }}>
      {/* Slide image / gradient fallback */}
      {slide.image ? (
        <img
          src={optimizeImageUrl(slide.image, 1200)}
          alt={slide.title}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          loading="eager"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, var(--storefront-primary, #004643), var(--storefront-accent, #000))` }}
        />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

      {/* Content */}
      <div className="absolute inset-0 flex items-end">
        <div className="w-full px-4 pb-14 sm:px-12 sm:pb-24 max-w-6xl mx-auto">
          <h1
            className="text-2xl font-bold text-white sm:text-5xl lg:text-6xl leading-tight drop-shadow-lg"
            style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
          >
            {slide.title}
          </h1>
          <p className="mt-2 text-sm text-white/80 sm:text-lg max-w-md">{slide.subtitle}</p>
          {slide.link ? (
            <Link
              to={slide.link}
              className="mt-5 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-105"
              style={{
                backgroundColor: "var(--storefront-primary, #004643)",
                color: "var(--storefront-btn-text, #fff)",
                borderRadius: "var(--storefront-button-radius, 0.5rem)",
              }}
            >
              Shop Now
            </Link>
          ) : (
            <button
              className="mt-5 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-105"
              style={{
                backgroundColor: "var(--storefront-primary, #004643)",
                color: "var(--storefront-btn-text, #fff)",
                borderRadius: "var(--storefront-button-radius, 0.5rem)",
              }}
            >
              Explore Collection
            </button>
          )}
        </div>
      </div>

      {/* Arrows */}
      {slideCount > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30">
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slideCount > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === current ? "24px" : "8px",
                backgroundColor: i === current ? "var(--storefront-primary, #fff)" : "rgba(255,255,255,0.5)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Category Pills ── */
function CategoryPills({ categories, slug }: { categories: any[] | undefined; slug: string }) {
  if (!categories || categories.length === 0) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            to={storefrontPath(slug, `category/${cat.slug}`)}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all hover:scale-105"
            style={{
              borderColor: "var(--storefront-primary, hsl(var(--border)))",
              color: "var(--storefront-text, hsl(var(--foreground)))",
            }}
          >
            {cat.image_url && (
              <img src={cat.image_url} alt={cat.name} className="h-6 w-6 rounded-full object-cover" loading="lazy" />
            )}
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Masonry Product Grid ── */
function MasonryGrid({ products, slug, store, cardStyle }: { products: any[]; slug: string; store: StoreData; cardStyle: string }) {
  return (
    <div className="columns-2 gap-3 sm:gap-4 md:columns-3 lg:columns-4 space-y-3 sm:space-y-4">
      {products.map((product, idx) => (
        <div key={product.id} className="break-inside-avoid">
          <UniversalProductCard product={product} slug={slug} store={store} priority={idx < 4} cardStyle={cardStyle} />
        </div>
      ))}
    </div>
  );
}

export default function StorefrontHomeV2() {
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
    customDomain: (store as any)?.custom_domain,
  });

  const { products, isLoading: isProductsLoading } = useStorefrontProducts(store.id);
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const themeConfig = useStorefrontThemeConfig(store.id);
  const cardStyle = themeConfig?.product_card_style || "style-1";

  const { products: bestSellingProducts } = useBestSellingProducts(store.id);

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
      {/* Hero Carousel */}
      <HeroCarousel store={store} />

      {/* Search bar */}
      <div className="border-b px-4 py-3" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))" }}>
        <div className="mx-auto max-w-6xl flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm transition-colors"
            style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))20", color: "var(--storefront-text, hsl(var(--foreground)))80" }}
          >
            <Search className="h-4 w-4 shrink-0" />
            <span>Search products...</span>
          </button>
          <button
            onClick={() => { setSearchOpen(true); setOpenFilters(true); }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
            style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <Suspense fallback={null}>
          <StorefrontSearchOverlay
            open={searchOpen}
            onClose={() => { setSearchOpen(false); setOpenFilters(false); }}
            products={products}
            slug={slug!}
            storeId={store.id}
            initialFiltersOpen={openFilters}
          />
        </Suspense>
      )}

      {/* Categories */}
      <UniversalCategories
        categories={storeCategories}
        storeSlug={slug!}
        isLoading={!storeCategories}
        categoryStyle={themeConfig?.category_style || "style-1"}
      />

      {/* Products */}
      <div className="mx-auto max-w-6xl px-3 sm:px-4 pb-12 space-y-8">
        {/* Sort bar */}
        <div className="flex items-center justify-between">
          <h2
            className="text-xl font-bold tracking-tight sm:text-2xl"
            style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
          >
            All Products
          </h2>
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))20" }}
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
              <div className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-xl border bg-popover shadow-lg" style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))10" }}>
                {([
                  { value: "popular", label: "Popular" },
                  { value: "price_asc", label: "Price: Low → High" },
                  { value: "price_desc", label: "Price: High → Low" },
                  { value: "newest", label: "Newest First" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className={`block w-full px-3 py-2 text-left text-xs font-medium transition-colors ${sortBy === opt.value ? "font-bold" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Masonry Grid */}
        {isProductsLoading ? (
          <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border bg-card">
                <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
                <div className="p-2.5 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : allSorted.length > 0 ? (
          <>
            <MasonryGrid products={allSorted.slice(0, 10)} slug={slug!} store={store} cardStyle={cardStyle} />
            {allSorted.length > 10 && (
              <LazyRender rootMargin="400px" minHeight={400}>
                <MasonryGrid products={allSorted.slice(10)} slug={slug!} store={store} cardStyle={cardStyle} />
              </LazyRender>
            )}
          </>
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center rounded-lg border bg-card">
            <p className="text-muted-foreground">No products available yet.</p>
          </div>
        )}
      </div>
      <LazyRender rootMargin="300px" minHeight={100}>
        <Suspense fallback={null}>
          <StorefrontTrustStrip storeId={store.id} currency={store.currency} />
        </Suspense>
      </LazyRender>
      <LazyRender rootMargin="300px" minHeight={100}>
        <Suspense fallback={null}>
          <StorefrontInstagramSection store={store} />
        </Suspense>
      </LazyRender>
    </>
  );
}
