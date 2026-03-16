import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, ShoppingCart, Tag, Truck, Shield, RotateCcw, ChevronRight } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Hero Image Section ── */
function MilanoHero({ store, slug }: { store: StoreData; slug: string }) {
  const heroUrl = store.mobile_hero_url || store.banner_url;

  if (!heroUrl) {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={{
          height: "420px",
          background: `linear-gradient(135deg, var(--storefront-accent, #3d1c28), var(--storefront-accent, #3d1c28)cc)`,
        }}
      >
        <div className="text-center space-y-3 px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70" style={{ color: "var(--storefront-primary, #b8873c)" }}>
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
              backgroundColor: "var(--storefront-primary, #b8873c)",
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
    <div className="w-full relative">
      <img
        src={optimizeImageUrl(heroUrl, 800)}
        alt={`${store.name} hero`}
        className="w-full h-auto object-cover"
        style={{ maxHeight: "520px" }}
        loading="eager"
        fetchPriority="high"
      />
    </div>
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
              style={{ borderColor: "var(--storefront-primary, #b8873c)40" }}
            >
              {cat.image_url ? (
                <img src={optimizeImageUrl(cat.image_url, 200)} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div
                  className="h-full w-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--storefront-primary, #b8873c)10" }}
                >
                  <Tag className="h-5 w-5" style={{ color: "var(--storefront-primary, #b8873c)" }} />
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
function AnnouncementStrip() {
  const items = [
    { icon: "🚚", text: "Free Shipping On All Orders" },
    { icon: "🔄", text: "Easy Returns" },
    { icon: "🔒", text: "Secure Payments" },
    { icon: "💰", text: "COD Available" },
  ];
  const separator = <span className="opacity-60">•</span>;

  return (
    <div
      className="w-full overflow-hidden py-2.5"
      style={{
        background: "var(--storefront-marquee-gradient, linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a))",
        color: "var(--storefront-text, #1a1a1a)",
      }}
    >
      <div className="flex w-max animate-marquee">
        {[0, 1].map((group) => (
          <div key={group} className="flex items-center gap-6 pr-6 md:gap-10 md:pr-10">
            {items.map((item, idx) => (
              <span key={`${group}-${idx}`} className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold">
                <span>{item.icon}</span>
                <span>{item.text}</span>
                {idx < items.length - 1 && separator}
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
          style={{ color: "var(--storefront-primary, #b8873c)" }}
        >
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/* ── Product Card (Milano style) ── */
function MilanoProductCard({ product, slug, index }: { product: any; slug: string; index: number }) {
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const effectivePrice = product.sale_price || product.price;
  const discount = product.sale_price && product.sale_price < product.price
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product.id,
      name: product.name,
      price: effectivePrice,
      image: product.image_url,
      quantity: 1,
    });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      productId: product.id,
      name: product.name,
      price: product.price,
      salePrice: product.sale_price,
      image: product.image_url,
      slug: product.slug,
    });
  };

  return (
    <Link
      to={storefrontPath(slug, `product/${product.slug || product.id}`)}
      className="group overflow-hidden transition-all active:scale-[0.98]"
      style={{
        borderRadius: "8px",
        backgroundColor: "#fff",
        border: "1px solid var(--storefront-text, #1a1a1a)08",
      }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
        {product.image_url ? (
          <img
            src={optimizeImageUrl(product.image_url, 400)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading={index < 4 ? "eager" : "lazy"}
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{ backgroundColor: "var(--storefront-primary, #b8873c)08" }}
          >
            <Tag className="h-10 w-10" style={{ color: "var(--storefront-text, #1a1a1a)20" }} />
          </div>
        )}

        {/* Discount badge */}
        {discount && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: "#e53935",
              color: "#fff",
              borderRadius: "4px",
            }}
          >
            -{discount}%
          </div>
        )}

        {/* Wishlist */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90"
          style={{
            backgroundColor: wishlisted ? "var(--storefront-primary, #b8873c)" : "rgba(255,255,255,0.9)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Heart
            className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`}
            style={{ color: wishlisted ? "#fff" : "var(--storefront-text, #1a1a1a)80" }}
          />
        </button>
      </div>

      {/* Product info */}
      <div className="p-2.5 space-y-1">
        <p
          className="text-[12px] font-medium line-clamp-1"
          style={{
            color: "var(--storefront-text, #1a1a1a)",
            fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif",
          }}
        >
          {product.name}
        </p>

        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
            ₹{Number(effectivePrice).toLocaleString("en-IN")}
          </span>
          {product.sale_price && product.sale_price < product.price && (
            <span className="text-[11px] line-through opacity-40">
              ₹{Number(product.price).toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {/* Add to Cart */}
        <button
          onClick={handleAddToCart}
          className="w-full flex items-center justify-center gap-1.5 mt-1.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-all active:scale-95"
          style={{
            backgroundColor: "var(--storefront-primary, #b8873c)",
            color: "var(--storefront-btn-text, #fff)",
            borderRadius: "var(--storefront-button-radius, 0.5rem)",
          }}
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
        </button>
      </div>
    </Link>
  );
}

/* ── Best Selling Horizontal Scroll ── */
function BestSellingSection({ products, slug }: { products: any[]; slug: string }) {
  const bestSellers = useMemo(() => products.filter(p => p.is_best_selling).slice(0, 10), [products]);
  if (bestSellers.length === 0) return null;

  return (
    <div className="py-4">
      <SectionHeader title="Best Selling" slug={slug} linkTo="best-sellers" />
      <div className="flex gap-3 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {bestSellers.map((product, idx) => (
          <div key={product.id} className="flex-shrink-0" style={{ width: "160px" }}>
            <MilanoProductCard product={product} slug={slug} index={idx} />
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
          borderColor: "var(--storefront-bg, #f7f5f0)40",
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
            style={{ backgroundColor: "var(--storefront-primary, #b8873c)08" }}
          >
            <Icon className="h-5 w-5" style={{ color: "var(--storefront-primary, #b8873c)" }} />
            <span
              className="text-[10px] font-semibold text-center"
              style={{ color: "var(--storefront-text, #1a1a1a)80" }}
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
  const effectiveSlug = slug || store.slug;

  return (
    <div>
      {/* Hero Image */}
      <MilanoHero store={store} slug={effectiveSlug} />

      {/* Category Circles */}
      <MilanoCategories categories={storeCategories} slug={effectiveSlug} />

      {/* Announcement Strip */}
      <AnnouncementStrip />

      {/* Best Selling */}
      {products && products.length > 0 && (
        <BestSellingSection products={products} slug={effectiveSlug} />
      )}

      {/* Story / About */}
      <StorySection store={store} />

      {/* All Products Grid */}
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
                <MilanoProductCard key={product.id} product={product} slug={effectiveSlug} index={idx} />
              ))}
            </div>

            {products.length > 6 && (
              <LazyRender rootMargin="600px" minHeight={400}>
                <div className="grid grid-cols-2 gap-3 px-4 mt-3">
                  {products.slice(6).map((product, idx) => (
                    <MilanoProductCard key={product.id} product={product} slug={effectiveSlug} index={idx + 6} />
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

      {/* Trust Badges */}
      <TrustBadges />
    </div>
  );
}
