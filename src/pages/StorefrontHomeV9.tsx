import { useState, useMemo, useEffect, useCallback } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, ShoppingCart, Share2, Tag, Truck, Shield, RotateCcw, ChevronUp, ChevronDown, Star, Plus } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Quick Category Chips ── */
function CategoryChips({ categories, slug }: { categories: any[] | undefined; slug: string }) {
  if (!categories || categories.length === 0) return null;
  return (
    <div className="sticky top-[52px] z-30 px-4 py-2.5" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))cc", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
        <Link
          to={storefrontPath(slug)}
          className="flex items-center gap-1.5 flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95"
          style={{
            scrollSnapAlign: "start",
            backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
            color: "var(--storefront-btn-text, #fff)",
          }}
        >
          All
        </Link>
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            to={storefrontPath(slug, `category/${cat.slug}`)}
            className="flex items-center gap-1.5 flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all active:scale-95 whitespace-nowrap"
            style={{
              scrollSnapAlign: "start",
              backgroundColor: "var(--storefront-text, hsl(var(--foreground)))06",
              color: "var(--storefront-text, hsl(var(--foreground)))80",
              border: "1px solid var(--storefront-text, hsl(var(--foreground)))08",
            }}
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Discovery Feed Card ── */
function FeedCard({ product, slug, store, index }: { product: any; slug: string; store: StoreData; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const { addToCart, items: cartItems, updateQuantity } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const cartItem = cartItems.find((i) => i.productId === product.id);
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
      slug: product.slug,
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

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${storefrontPath(slug, `product/${product.slug || product.id}`)}`;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch {}
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="px-4 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
      <div
        className="relative overflow-hidden transition-all"
        style={{ borderRadius: "20px", boxShadow: "0 4px 24px -8px var(--storefront-text, hsl(var(--foreground)))12" }}
      >
        {/* Image */}
        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)}>
          <div className="relative" style={{ aspectRatio: "3/4" }}>
            {product.image_url ? (
              <img
                src={optimizeImageUrl(product.image_url, 600)}
                alt={product.name}
                className="h-full w-full object-cover"
                loading={index < 2 ? "eager" : "lazy"}
              />
            ) : (
              <div
                className="h-full w-full flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, var(--storefront-primary, #7C3AED)20, var(--storefront-accent, #22C55E)10)` }}
              >
                <Tag className="h-12 w-12" style={{ color: "var(--storefront-text, hsl(var(--foreground)))15" }} />
              </div>
            )}

            {/* Bottom gradient overlay */}
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

            {/* Discount badge */}
            {discount && (
              <div
                className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, #fff)" }}
              >
                {discount}% OFF
              </div>
            )}

            {/* Product info overlay */}
            <div className="absolute bottom-0 left-0 right-14 p-4">
              <h3 className="text-white text-lg font-bold leading-tight drop-shadow-lg line-clamp-2" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>
                {product.name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-white text-xl font-extrabold drop-shadow-lg">
                  ₹{Number(effectivePrice).toLocaleString("en-IN")}
                </span>
                {product.sale_price && product.sale_price < product.price && (
                  <span className="text-white/60 text-sm line-through">
                    ₹{Number(product.price).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              {product.is_best_selling && (
                <div className="flex items-center gap-1 mt-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-white/80 text-[11px] font-medium">Best Seller</span>
                </div>
              )}
            </div>

            {/* Floating Action Stack */}
            <div className="absolute right-3 bottom-4 flex flex-col gap-2.5">
              <button
                onClick={handleToggleWishlist}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
                style={{
                  backgroundColor: wishlisted ? "var(--storefront-primary, #EF4444)" : "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <Heart className={`h-5 w-5 ${wishlisted ? "fill-current" : ""}`} style={{ color: "#fff" }} />
              </button>
              <button
                onClick={handleShare}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
                style={{ backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(12px)" }}
              >
                <Share2 className="h-5 w-5" style={{ color: "#fff" }} />
              </button>
              <button
                onClick={handleAddToCart}
                className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all active:scale-90"
                style={{
                  backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                  color: "var(--storefront-btn-text, #fff)",
                  boxShadow: "0 4px 16px var(--storefront-primary, hsl(var(--primary)))40",
                }}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Link>

        {/* Expandable Details Panel */}
        <div
          className="overflow-hidden transition-all duration-300"
          style={{
            maxHeight: expanded ? "300px" : "0px",
            backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
          }}
        >
          <div className="p-4 space-y-3">
            {product.description && (
              <p className="text-sm leading-relaxed opacity-70 line-clamp-3">{product.description}</p>
            )}
            <div className="flex gap-2">
              <Link
                to={storefrontPath(slug, `product/${product.slug || product.id}`)}
                className="flex-1 flex items-center justify-center py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95"
                style={{
                  backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                  color: "var(--storefront-btn-text, #fff)",
                }}
              >
                View Details
              </Link>
              <button
                onClick={handleAddToCart}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95"
                style={{
                  border: "2px solid var(--storefront-primary, hsl(var(--primary)))",
                  color: "var(--storefront-primary, hsl(var(--primary)))",
                }}
              >
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </button>
            </div>
          </div>
        </div>

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center py-1.5 transition-all"
          style={{ backgroundColor: "var(--storefront-text, hsl(var(--foreground)))04" }}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" style={{ color: "var(--storefront-text, hsl(var(--foreground)))40" }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: "var(--storefront-text, hsl(var(--foreground)))40" }} />
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Recommended Horizontal Scroll ── */
function RecommendedSection({ products, slug, store }: { products: any[]; slug: string; store: StoreData }) {
  const recommended = useMemo(() => products.filter(p => p.is_best_selling).slice(0, 8), [products]);
  if (recommended.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>Recommended for You</h3>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {recommended.map((product) => (
          <Link
            key={product.id}
            to={storefrontPath(slug, `product/${product.slug || product.id}`)}
            className="flex-shrink-0 w-36 overflow-hidden transition-all active:scale-[0.97]"
            style={{ borderRadius: "16px", border: "1px solid var(--storefront-text, hsl(var(--foreground)))06" }}
          >
            <div style={{ aspectRatio: "4/5" }}>
              {product.image_url ? (
                <img src={optimizeImageUrl(product.image_url, 300)} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))06" }}>
                  <Tag className="h-6 w-6" style={{ color: "var(--storefront-text, hsl(var(--foreground)))15" }} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-[11px] font-semibold line-clamp-1">{product.name}</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>
                ₹{Number(product.sale_price || product.price).toLocaleString("en-IN")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Trust Strip ── */
function TrustStrip() {
  const items = [
    { icon: Truck, label: "Fast Shipping" },
    { icon: Shield, label: "Secure Checkout" },
    { icon: RotateCcw, label: "Easy Returns" },
  ];
  return (
    <div className="px-4 py-4">
      <div className="flex gap-2">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))06" }}>
            <Icon className="h-4 w-4" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }} />
            <span className="text-[9px] font-semibold text-center" style={{ color: "var(--storefront-text, hsl(var(--foreground)))70" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StorefrontHomeV9() {
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
      {/* Category Chips */}
      <CategoryChips categories={storeCategories} slug={effectiveSlug} />

      {/* Discovery Feed */}
      <div className="space-y-5 py-3">
        {!products ? (
          <div className="px-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[65vh] w-full" style={{ borderRadius: "20px" }} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            {/* First batch eagerly rendered */}
            {products.slice(0, 4).map((product, idx) => (
              <FeedCard key={product.id} product={product} slug={effectiveSlug} store={store} index={idx} />
            ))}

            {/* Recommended section after initial feed */}
            {products.length > 0 && <RecommendedSection products={products} slug={effectiveSlug} store={store} />}

            {/* Trust Strip */}
            <TrustStrip />

            {/* Remaining products lazy loaded */}
            {products.length > 4 && (
              <LazyRender rootMargin="600px" minHeight={400}>
                <div className="space-y-5">
                  {products.slice(4).map((product, idx) => (
                    <FeedCard key={product.id} product={product} slug={effectiveSlug} store={store} index={idx} />
                  ))}
                </div>
              </LazyRender>
            )}
          </>
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center px-4">
            <div className="text-center space-y-2">
              <Tag className="h-12 w-12 mx-auto" style={{ color: "var(--storefront-text, hsl(var(--foreground)))15" }} />
              <p className="text-muted-foreground">No products available yet.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
