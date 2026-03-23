import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { withAlpha } from "@/lib/storefrontColors";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { Tag, Truck, Shield, RotateCcw, ChevronRight } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import LazyRender from "@/components/storefront/LazyRender";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import StorefrontInstagramSection from "@/components/storefront/StorefrontInstagramSection";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";

/* ── Hero Image Section ── */
function MilanoHero({ store, slug }: { store: StoreData; slug: string }) {
  const heroImages: string[] = [];
  const mhi = (store as any).mobile_hero_images;
  if (mhi && Array.isArray(mhi) && mhi.length > 0) {
    heroImages.push(...mhi);
  } else {
    const heroUrl = store.mobile_hero_url || store.banner_url;
    if (heroUrl) heroImages.push(heroUrl);
  }

  if (heroImages.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={{
          height: "420px",
          background: `linear-gradient(135deg, var(--storefront-accent, #3d1c28), ${withAlpha("var(--storefront-accent, #3d1c28)", "cc")})`,
        }}
      >
        <div className="text-center space-y-3 px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70" style={{ color: "var(--storefront-primary, #1a1a1a)" }}>
            Welcome to
          </p>
          <h1
            className="text-3xl font-bold"
            style={{
              color: "var(--storefront-bg, #f7f5f0)",
              fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif",
            }}
          >
            {store.name}
          </h1>
          {store.description && (
            <p className="text-sm opacity-60 max-w-xs mx-auto" style={{ color: "var(--storefront-bg, #f7f5f0)" }}>
              {store.description}
            </p>
          )}
          <Link
            to={storefrontPath(slug, "best-sellers")}
            className="inline-flex items-center gap-1.5 mt-2 px-6 py-2.5 text-sm font-semibold transition-all active:scale-95"
            style={{
              backgroundColor: "var(--storefront-primary, #1a1a1a)",
              color: "var(--storefront-btn-text, #fff)",
              borderRadius: "var(--storefront-button-radius, 0.5rem)",
            }}
          >
            Shop Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <HeroBannerCarousel
      images={heroImages}
      storeName={store.name}
      interval={2000}
      imageClassName="w-full h-auto object-cover"
      maxHeight="520px"
    />
  );
}

/* ── Category Circles (horizontal scroll) ── */
function MilanoCategories({ categories, slug }: { categories: any[] | undefined; slug: string }) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="px-4 py-5">
      <div className="flex gap-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            to={storefrontPath(slug, `category/${cat.slug}`)}
            className="flex flex-col items-center gap-2 flex-shrink-0 transition-all active:scale-95"
          >
            <div
              className="h-[72px] w-[72px] rounded-full overflow-hidden border-2 sm:h-20 sm:w-20"
              style={{ borderColor: withAlpha("var(--storefront-primary, #1a1a1a)", "40") }}
            >
              {cat.image_url ? (
                <img src={optimizeImageUrl(cat.image_url, 200)} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div
                  className="h-full w-full flex items-center justify-center"
                  style={{ backgroundColor: withAlpha("var(--storefront-primary, #1a1a1a)", "10") }}
                >
                  <Tag className="h-5 w-5" style={{ color: "var(--storefront-primary, #1a1a1a)" }} />
                </div>
              )}
            </div>
            <span
              className="text-[11px] font-semibold text-center leading-tight max-w-[76px]"
              style={{
                color: "var(--storefront-text, #1a1a1a)",
                fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif",
              }}
            >
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Announcement Strip ── */
function AnnouncementStrip({ customText }: { customText?: string }) {
  const DEFAULT_TEXT = "🚚 Free Shipping On All Orders • 🔄 Easy Returns • 🔒 Secure Payments • 💰 COD Available";
  const displayText = customText || DEFAULT_TEXT;
  const segments = displayText.split(" • ").filter(Boolean);

  return (
    <div
      className="w-full overflow-hidden py-2.5"
      style={{
        background: "var(--storefront-marquee-gradient, linear-gradient(90deg, #1a1a1a, #333, #1a1a1a))",
        color: "var(--storefront-text, #1a1a1a)",
      }}
    >
      <div className="flex w-max animate-marquee">
        {[0, 1].map((group) => (
          <div key={group} className="flex items-center gap-6 pr-6 md:gap-10 md:pr-10">
            {segments.map((segment, idx) => (
              <span key={`${group}-${idx}`} className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold">
                <span>{segment.trim()}</span>
                {idx < segments.length - 1 && <span className="opacity-60">•</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, slug, linkTo }: { title: string; slug: string; linkTo?: string }) {
  return (
    <div className="flex items-center justify-between px-4 mb-3">
      <h2
        className="text-lg font-bold"
        style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif", color: "var(--storefront-text, #1a1a1a)" }}
      >
        {title}
      </h2>
      {linkTo && (
        <Link
          to={storefrontPath(slug, linkTo)}
          className="text-xs font-semibold flex items-center gap-0.5 transition-opacity hover:opacity-70"
          style={{ color: "var(--storefront-primary, #1a1a1a)" }}
        >
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}


/* ── Best Selling Horizontal Scroll ── */
function BestSellingSection({ products, slug, store, cardStyle }: { products: any[]; slug: string; store: any; cardStyle: string }) {
  const bestSellers = useMemo(() => products.filter(p => p.is_best_selling).slice(0, 10), [products]);
  if (bestSellers.length === 0) return null;

  return (
    <div className="py-4">
      <SectionHeader title="Best Selling" slug={slug} linkTo="best-sellers" />
      <div className="flex gap-3 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {bestSellers.map((product, idx) => (
          <div key={product.id} className="flex-shrink-0" style={{ width: "160px" }}>
            <UniversalProductCard product={product} slug={slug} store={store} priority={idx < 4} cardStyle={cardStyle} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── About / Story Section ── */
function StorySection({ store }: { store: StoreData }) {
  if (!store.description) return null;

  return (
    <div
      className="mx-4 my-4 p-6 text-center"
      style={{
        backgroundColor: "var(--storefront-accent, #3d1c28)",
        color: "var(--storefront-bg, #f7f5f0)",
        borderRadius: "12px",
      }}
    >
      <p className="text-sm leading-relaxed opacity-80 italic max-w-md mx-auto">
        "{store.description}"
      </p>
      <Link
        to={storefrontPath(store.slug, "contact")}
        className="inline-flex items-center gap-1 mt-4 px-5 py-2 text-xs font-semibold uppercase tracking-wider border transition-all active:scale-95"
        style={{
          borderColor: withAlpha("var(--storefront-bg, #f7f5f0)", "40"),
          color: "var(--storefront-bg, #f7f5f0)",
          borderRadius: "var(--storefront-button-radius, 0.5rem)",
        }}
      >
        Learn More
      </Link>
    </div>
  );
}

/* ── Trust Badges ── */
function TrustBadges() {
  const items = [
    { icon: Truck, label: "Free Shipping" },
    { icon: RotateCcw, label: "Easy Returns" },
    { icon: Shield, label: "Secure Payments" },
  ];

  return (
    <div className="px-4 py-5">
      <div className="flex gap-3">
        {items.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl"
            style={{ backgroundColor: withAlpha("var(--storefront-primary, #1a1a1a)", "08") }}
          >
            <Icon className="h-5 w-5" style={{ color: "var(--storefront-primary, #1a1a1a)" }} />
            <span
              className="text-[10px] font-semibold text-center"
              style={{ color: withAlpha("var(--storefront-text, #1a1a1a)", "80") }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Home Page ── */
export default function StorefrontHomeV10() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

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
  const cardStyle = themeConfig?.product_card_style || "style-2";
  const categoryStyle = themeConfig?.category_style || "style-1";
  const effectiveSlug = slug || store.slug;

  return (
    <div>
      <MilanoHero store={store} slug={effectiveSlug} />
      <UniversalCategories categories={storeCategories} storeSlug={effectiveSlug} categoryStyle={categoryStyle} />
      {(themeConfig?.marquee_enabled ?? true) && <AnnouncementStrip customText={themeConfig?.marquee_text} />}
      {products && products.length > 0 && (
        <BestSellingSection products={products} slug={effectiveSlug} store={store} cardStyle={cardStyle} />
      )}
      <StorySection store={store} />
      <div className="py-4">
        <SectionHeader title="Curated For You" slug={effectiveSlug} linkTo="best-sellers" />
        {!products ? (
          <div className="grid grid-cols-2 gap-3 px-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-lg" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 px-4">
              {products.slice(0, 6).map((product, idx) => (
                <UniversalProductCard key={product.id} product={product} slug={effectiveSlug} store={store} priority={idx < 4} cardStyle={cardStyle} />
              ))}
            </div>
            {products.length > 6 && (
              <LazyRender rootMargin="600px" minHeight={400}>
                <div className="grid grid-cols-2 gap-3 px-4 mt-3">
                  {products.slice(6).map((product, idx) => (
                    <UniversalProductCard key={product.id} product={product} slug={effectiveSlug} store={store} cardStyle={cardStyle} />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="text-center space-y-2">
              <Tag className="h-12 w-12 mx-auto" style={{ color: "var(--storefront-text, #1a1a1a)20" }} />
              <p className="text-sm" style={{ color: "var(--storefront-text, #1a1a1a)60" }}>No products available yet.</p>
            </div>
          </div>
        )}
      </div>
      <TrustBadges />
      <StorefrontInstagramSection store={store} />
    </div>
  );
}