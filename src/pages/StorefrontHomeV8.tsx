import { useState, useMemo, useEffect, useRef } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { ArrowUpDown, Zap, Tag, Clock, Truck, Shield, RotateCcw } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import StorefrontInstagramSection from "@/components/storefront/StorefrontInstagramSection";

/* ── Hero Carousel (Embla) ── */
function HeroCarousel({ store }: { store: StoreData }) {
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  const slides = useMemo(() => {
    const s: { image: string; title: string; subtitle?: string; link?: string }[] = [];
    if ((store as any).banner_url) s.push({ image: (store as any).banner_url, title: store.name, subtitle: "Shop the latest collection" });
    if ((store as any).mobile_hero_url) s.push({ image: (store as any).mobile_hero_url, title: "New Arrivals", subtitle: "Fresh styles just landed" });
    const best = products?.filter((p: any) => p.is_best_selling && p.image_url).slice(0, 3) || [];
    best.forEach((p: any) => s.push({ image: p.image_url, title: p.name, subtitle: `₹${Number(p.sale_price || p.price).toLocaleString("en-IN")}`, link: storefrontPath(store.slug, `product/${p.slug || p.id}`) }));
    if (s.length === 0) s.push({ image: "", title: store.name, subtitle: "Welcome to our store" });
    return s;
  }, [store, products]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" }, [Autoplay({ delay: 4000, stopOnInteraction: false })]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  return (
    <div className="px-4 pt-3 pb-1">
      <div ref={emblaRef} className="overflow-hidden rounded-2xl">
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
              <div className="relative h-44 sm:h-52 overflow-hidden rounded-2xl">
                {slide.image ? (
                  <img src={optimizeImageUrl(slide.image, 800)} alt={slide.title} className="absolute inset-0 h-full w-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, var(--storefront-primary, #6C5CE7), var(--storefront-accent, #FD79A8))` }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h2 className="text-white text-lg font-bold drop-shadow-lg leading-tight" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>
                    {slide.title}
                  </h2>
                  {slide.subtitle && <p className="text-white/80 text-xs mt-0.5">{slide.subtitle}</p>}
                  {slide.link && (
                    <Link to={slide.link} className="inline-block mt-2 px-4 py-1.5 text-xs font-bold rounded-full transition-all active:scale-95" style={{ backgroundColor: "var(--storefront-primary, #6C5CE7)", color: "var(--storefront-btn-text, #fff)" }}>
                      Shop Now
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Dot Indicators */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => emblaApi?.scrollTo(i)} className="rounded-full transition-all" style={{
              width: i === selected ? "20px" : "6px",
              height: "6px",
              backgroundColor: i === selected ? "var(--storefront-primary, #6C5CE7)" : "var(--storefront-text, #1a1a1a)20",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Circular Category Strip ── */
function CategoryStrip({ categories, slug }: { categories: any[] | undefined; slug: string }) {
  if (!categories || categories.length === 0) return null;
  return (
    <div className="px-4 py-3">
      <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            to={storefrontPath(slug, `category/${cat.slug}`)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all active:scale-95"
            style={{ scrollSnapAlign: "start" }}
          >
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center overflow-hidden shadow-md transition-all"
              style={{
                backgroundColor: "var(--storefront-primary, hsl(var(--primary)))08",
                border: "2px solid var(--storefront-primary, hsl(var(--primary)))30",
              }}
            >
              {cat.image_url ? (
                <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover rounded-full" loading="lazy" />
              ) : (
                <Tag className="h-6 w-6" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }} />
              )}
            </div>
            <span className="text-[10px] font-semibold text-center leading-tight w-16 line-clamp-1" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Flash Deals with Countdown ── */
function FlashDeals({ products, slug }: { products: any[]; slug: string }) {
  const deals = useMemo(() => products.filter((p) => p.sale_price && p.sale_price < p.price).slice(0, 10), [products]);

  // Seed countdown from a consistent daily offset
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const diff = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
    return { h: Math.floor(diff / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 };
  });

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
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}>
            <Zap className="h-4 w-4" style={{ color: "var(--storefront-btn-text, #fff)" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>Flash Deals</h3>
            <p className="text-[10px] opacity-50">Limited time offers</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }} />
          <div className="flex gap-1">
            {[String(timeLeft.h).padStart(2, "0"), String(timeLeft.m).padStart(2, "0"), String(timeLeft.s).padStart(2, "0")].map((t, i) => (
              <span key={i} className="flex items-center">
                <span className="rounded-lg px-1.5 py-1 text-[11px] font-bold tabular-nums" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, #fff)" }}>
                  {t}
                </span>
                {i < 2 && <span className="text-[11px] font-bold mx-0.5" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>:</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
        {deals.map((product) => {
          const discount = Math.round(((product.price - product.sale_price) / product.price) * 100);
          return (
            <Link
              key={product.id}
              to={storefrontPath(slug, `product/${product.slug || product.id}`)}
              className="flex-shrink-0 w-36 overflow-hidden rounded-2xl shadow-sm transition-all active:scale-[0.97]"
              style={{ scrollSnapAlign: "start", backgroundColor: "var(--storefront-bg, hsl(var(--background)))", border: "1px solid var(--storefront-text, hsl(var(--foreground)))08" }}
            >
              <div className="relative" style={{ aspectRatio: "1/1" }}>
                {product.image_url ? (
                  <img src={optimizeImageUrl(product.image_url, 300)} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))08" }}>
                    <Tag className="h-8 w-8" style={{ color: "var(--storefront-text, hsl(var(--foreground)))15" }} />
                  </div>
                )}
                <span className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, #fff)" }}>
                  {discount}% OFF
                </span>
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-[11px] font-semibold line-clamp-1">{product.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>₹{Number(product.sale_price).toLocaleString("en-IN")}</span>
                  <span className="text-[10px] line-through opacity-40">₹{Number(product.price).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Trust Badges ── */
function TrustBadges() {
  const badges = [
    { icon: Truck, label: "Free Shipping" },
    { icon: Shield, label: "Secure Payment" },
    { icon: RotateCcw, label: "Easy Returns" },
  ];
  return (
    <div className="px-4 py-3">
      <div className="flex gap-2 justify-between">
        {badges.map(({ icon: Icon, label }) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))06" }}>
            <Icon className="h-5 w-5" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }} />
            <span className="text-[10px] font-semibold text-center" style={{ color: "var(--storefront-text, hsl(var(--foreground)))80" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StorefrontHomeV8() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const [sortOpen, setSortOpen] = useState(false);

  useStoreJsonLd({
    storeName: store.name,
    storeSlug: store.slug,
    description: store.description,
    logo: store.logo_url,
    location: store.location,
    whatsappNumber: store.whatsapp_number,
  });

  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const themeConfig = useStorefrontThemeConfig(store.id);
  const cardStyle = themeConfig?.product_card_style || "style-1";
  const categoryStyle = themeConfig?.category_style || "style-1";
  const effectiveSlug = slug || store.slug;

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
    <div className="space-y-1">
      {/* Hero Carousel */}
      <HeroCarousel store={store} />

      {/* Category Strip */}
      <UniversalCategories categories={storeCategories} storeSlug={effectiveSlug} categoryStyle={categoryStyle} />

      {/* Flash Deals */}
      {products && <FlashDeals products={products} slug={effectiveSlug} />}

      {/* Trust Badges */}
      <TrustBadges />

      {/* Product Grid */}
      <div className="px-4 pb-8 space-y-3">
        {/* Sort header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>All Products</h2>
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all active:scale-95"
              style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))15" }}
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortBy === "popular" && "Popular"}
              {sortBy === "price_asc" && "Low"}
              {sortBy === "price_desc" && "High"}
              {sortBy === "newest" && "New"}
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-2xl border bg-popover shadow-xl">
                {([
                  { value: "popular", label: "Popular" },
                  { value: "price_asc", label: "Price: Low → High" },
                  { value: "price_desc", label: "Price: High → Low" },
                  { value: "newest", label: "Newest First" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className={`block w-full px-4 py-2.5 text-left text-xs transition-colors ${sortBy === opt.value ? "font-bold" : ""}`}
                    style={{ backgroundColor: sortBy === opt.value ? "var(--storefront-primary, hsl(var(--primary)))08" : "transparent" }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        {!products ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-60 rounded-2xl" />
            ))}
          </div>
        ) : allSorted.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {allSorted.slice(0, 8).map((product, idx) => (
                <UniversalProductCard key={product.id} product={product} slug={effectiveSlug} store={store} priority={idx < 4} cardStyle={cardStyle} />
              ))}
            </div>
            {allSorted.length > 8 && (
              <LazyRender rootMargin="400px" minHeight={400}>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {allSorted.slice(8).map((product) => (
                    <UniversalProductCard key={product.id} product={product} slug={effectiveSlug} store={store} cardStyle={cardStyle} />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl border bg-card">
            <p className="text-muted-foreground">No products available yet.</p>
          </div>
        )}
      </div>
      <StorefrontInstagramSection store={store} />
    </div>
  );
}
