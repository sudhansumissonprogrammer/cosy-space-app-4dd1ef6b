import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, ShoppingCart, Star, Tag, Truck, Shield, RotateCcw, ChevronRight, Flame } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import LazyRender from "@/components/storefront/LazyRender";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Hero Campaign Carousel ── */
function HeroCampaign({ store, slug }: { store: StoreData; slug: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 4000, stopOnInteraction: false })]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  // Use store banner + mobile hero as campaign images
  const banners = [store.banner_url, store.mobile_hero_url].filter(Boolean) as string[];

  if (banners.length === 0) {
    return (
      <div className="px-4 pt-3">
        <div
          className="relative overflow-hidden flex items-center justify-center"
          style={{
            borderRadius: "20px",
            height: "200px",
            background: `linear-gradient(135deg, var(--storefront-primary, #FF3F6C)15, var(--storefront-accent, #111)08)`,
          }}
        >
          <div className="text-center space-y-2 px-6">
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--storefront-heading-font, inherit)", color: "var(--storefront-text, hsl(var(--foreground)))" }}>
              {store.name}
            </h2>
            <p className="text-sm opacity-60">Discover the latest collection</p>
            <Link
              to={storefrontPath(slug, "best-sellers")}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
              style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)", color: "var(--storefront-btn-text, #fff)" }}
            >
              Shop Now <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
      <div className="relative overflow-hidden" style={{ borderRadius: "20px" }}>
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {banners.map((url, idx) => (
              <div key={idx} className="min-w-0 flex-[0_0_100%]">
                <div style={{ aspectRatio: "16/9" }}>
                  <img src={optimizeImageUrl(url, 800)} alt={`${store.name} campaign ${idx + 1}`} className="h-full w-full object-cover" loading="eager" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, idx) => (
              <div
                key={idx}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: idx === selectedIdx ? "20px" : "6px",
                  backgroundColor: idx === selectedIdx ? "var(--storefront-primary, #FF3F6C)" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Style Category Strip ── */
function StyleCategories({ categories, slug }: { categories: any[] | undefined; slug: string }) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="px-4 py-5">
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            to={storefrontPath(slug, `category/${cat.slug}`)}
            className="flex-shrink-0 relative overflow-hidden transition-all active:scale-[0.97]"
            style={{ width: "80px", borderRadius: "16px" }}
          >
            <div className="relative" style={{ aspectRatio: "3/4" }}>
              {cat.image_url ? (
                <img src={optimizeImageUrl(cat.image_url, 200)} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-full w-full" style={{ background: `linear-gradient(135deg, var(--storefront-primary, #FF3F6C)20, var(--storefront-accent, #111)10)` }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold text-white drop-shadow-lg">
                {cat.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Trending Strip ── */
function TrendingStrip({ products, slug }: { products: any[]; slug: string }) {
  const trending = useMemo(() => products.filter(p => p.is_best_selling).slice(0, 10), [products]);
  if (trending.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-4 w-4" style={{ color: "var(--storefront-primary, #FF3F6C)" }} />
        <h3 className="text-base font-bold" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>Trending Now</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {trending.map((product) => {
          const effectivePrice = product.sale_price || product.price;
          const discount = product.sale_price && product.sale_price < product.price
            ? Math.round(((product.price - product.sale_price) / product.price) * 100)
            : null;
          return (
            <Link
              key={product.id}
              to={storefrontPath(slug, `product/${product.slug || product.id}`)}
              className="flex-shrink-0 w-36 overflow-hidden transition-all active:scale-[0.97]"
              style={{ borderRadius: "16px", border: "1px solid var(--storefront-text, hsl(var(--foreground)))06" }}
            >
              <div className="relative" style={{ aspectRatio: "4/5" }}>
                {product.image_url ? (
                  <img src={optimizeImageUrl(product.image_url, 300)} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)06" }}>
                    <Tag className="h-8 w-8" style={{ color: "var(--storefront-text, hsl(var(--foreground)))15" }} />
                  </div>
                )}
                {discount && (
                  <div className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)", color: "var(--storefront-btn-text, #fff)" }}>
                    {discount}% OFF
                  </div>
                )}
              </div>
              <div className="p-2.5 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-50" style={{ fontFamily: "var(--storefront-body-font, inherit)" }}>
                  {product.category || "Brand"}
                </p>
                <p className="text-xs font-semibold line-clamp-1">{product.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold" style={{ color: "var(--storefront-primary, #FF3F6C)" }}>
                    ₹{Number(effectivePrice).toLocaleString("en-IN")}
                  </span>
                  {product.sale_price && product.sale_price < product.price && (
                    <span className="text-[10px] line-through opacity-40">₹{Number(product.price).toLocaleString("en-IN")}</span>
                  )}
                </div>
                {product.is_best_selling && (
                  <div className="flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-[9px] font-medium opacity-60">Popular</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Fashion Collection Cards ── */
function FashionCollections({ categories, slug }: { categories: any[] | undefined; slug: string }) {
  if (!categories || categories.length < 2) return null;
  const collections = categories.slice(0, 4);

  return (
    <div className="px-4 py-4">
      <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>Collections</h3>
      <div className="grid grid-cols-2 gap-3">
        {collections.map((cat, idx) => (
          <Link
            key={cat.id}
            to={storefrontPath(slug, `category/${cat.slug}`)}
            className="relative overflow-hidden transition-all active:scale-[0.97]"
            style={{
              borderRadius: "20px",
              aspectRatio: idx === 0 || idx === 3 ? "3/4" : "1/1",
              gridRow: idx === 0 ? "span 2" : undefined,
            }}
          >
            {cat.image_url ? (
              <img src={optimizeImageUrl(cat.image_url, 400)} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-full w-full" style={{ background: `linear-gradient(135deg, var(--storefront-primary, #FF3F6C)15, var(--storefront-accent, #111)08)` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white text-sm font-bold drop-shadow-lg" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>
                {cat.name}
              </p>
              <p className="text-white/70 text-[10px] font-medium mt-0.5">Shop Now →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Fashion Product Card ── */
function FashionProductCard({ product, slug, index }: { product: any; slug: string; index: number }) {
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
      style={{ borderRadius: "20px", border: "1px solid var(--storefront-text, hsl(var(--foreground)))06" }}
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
          <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)06" }}>
            <Tag className="h-10 w-10" style={{ color: "var(--storefront-text, hsl(var(--foreground)))15" }} />
          </div>
        )}

        {/* Discount */}
        {discount && (
          <div className="absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)", color: "var(--storefront-btn-text, #fff)" }}>
            {discount}% OFF
          </div>
        )}

        {/* Wishlist */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90"
          style={{
            backgroundColor: wishlisted ? "var(--storefront-primary, #FF3F6C)" : "rgba(255,255,255,0.85)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} style={{ color: wishlisted ? "var(--storefront-btn-text, #fff)" : "var(--storefront-text, hsl(var(--foreground)))60" }} />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-wider opacity-40">
          {product.category || "Brand"}
        </p>
        <p className="text-xs font-semibold line-clamp-1" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
          {product.name}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold">
            ₹{Number(effectivePrice).toLocaleString("en-IN")}
          </span>
          {product.sale_price && product.sale_price < product.price && (
            <span className="text-[10px] line-through opacity-40">₹{Number(product.price).toLocaleString("en-IN")}</span>
          )}
        </div>
        {product.is_best_selling && (
          <div className="flex items-center gap-0.5 pt-0.5">
            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
            <span className="text-[9px] font-medium opacity-60">Bestseller</span>
          </div>
        )}

        {/* Add to Cart */}
        <button
          onClick={handleAddToCart}
          className="w-full flex items-center justify-center gap-1.5 mt-2 py-2 rounded-full text-xs font-semibold transition-all active:scale-95"
          style={{
            border: "1.5px solid var(--storefront-primary, #FF3F6C)",
            color: "var(--storefront-primary, #FF3F6C)",
          }}
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Add to Bag
        </button>
      </div>
    </Link>
  );
}

/* ── Fashion Deals Banner ── */
function FashionDeals() {
  return (
    <div className="px-4 py-4">
      <div
        className="relative overflow-hidden p-5 flex flex-col items-center justify-center text-center"
        style={{
          borderRadius: "20px",
          background: `linear-gradient(135deg, var(--storefront-primary, #FF3F6C), var(--storefront-primary, #FF3F6C)cc)`,
          minHeight: "120px",
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Limited Time</span>
        <h3 className="text-2xl font-extrabold text-white" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>Fashion Sale</h3>
        <p className="text-sm text-white/80 mt-1">Up to 50% off on trending styles</p>
      </div>
    </div>
  );
}

/* ── Trust Strip ── */
function TrustStrip() {
  const items = [
    { icon: RotateCcw, label: "Easy Returns" },
    { icon: Shield, label: "Secure Pay" },
    { icon: Truck, label: "Fast Delivery" },
  ];
  return (
    <div className="px-4 py-4">
      <div className="flex gap-2">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)06" }}>
            <Icon className="h-4 w-4" style={{ color: "var(--storefront-primary, #FF3F6C)" }} />
            <span className="text-[9px] font-semibold text-center" style={{ color: "var(--storefront-text, hsl(var(--foreground)))70" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
      {/* Hero Campaign */}
      <HeroCampaign store={store} slug={effectiveSlug} />

      {/* Style Categories */}
      <StyleCategories categories={storeCategories} slug={effectiveSlug} />

      {/* Trending Strip */}
      {products && products.length > 0 && (
        <TrendingStrip products={products} slug={effectiveSlug} />
      )}

      {/* Fashion Collections */}
      <FashionCollections categories={storeCategories} slug={effectiveSlug} />

      {/* Fashion Deals Banner */}
      <FashionDeals />

      {/* Product Grid */}
      <div className="px-4 py-4">
        <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>Just For You</h3>
        {!products ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72" style={{ borderRadius: "20px" }} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {products.slice(0, 6).map((product, idx) => (
                <FashionProductCard key={product.id} product={product} slug={effectiveSlug} index={idx} />
              ))}
            </div>

            {/* Remaining products lazy loaded */}
            {products.length > 6 && (
              <LazyRender rootMargin="600px" minHeight={400}>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {products.slice(6).map((product, idx) => (
                    <FashionProductCard key={product.id} product={product} slug={effectiveSlug} index={idx + 6} />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="text-center space-y-2">
              <Tag className="h-12 w-12 mx-auto" style={{ color: "var(--storefront-text, hsl(var(--foreground)))15" }} />
              <p className="text-muted-foreground">No products available yet.</p>
            </div>
          </div>
        )}
      </div>

      {/* Trust Strip */}
      <TrustStrip />
    </div>
  );
}
