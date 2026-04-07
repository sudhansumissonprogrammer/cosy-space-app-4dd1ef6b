import { useCallback } from "react";
import { Heart, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import type { Tables } from "@/integrations/supabase/types";
import { optimizeImageUrl, resolveProductImages } from "@/lib/imageOptimize";
import { storefrontPath } from "@/lib/subdomain";

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
}

export default function ProductCardStyle5({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  const price = product.sale_price || product.price;
  const originalPrice = product.sale_price ? product.price : null;
  const hasDiscount = originalPrice && originalPrice > price;
  const discountPercent = hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const currency = store.currency === "USD" ? "$" : "₹";

  const images = resolveProductImages(product);
  const imgSrc = images[0] ? optimizeImageUrl(images[0], 480) : "/placeholder.svg";

  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onVariantRequired) { onVariantRequired(); return; }
    addToCart({
      productId: product.id,
      name: product.name,
      price,
      image: images[0] || undefined,
      quantity: 1,
    });
  }, [addToCart, product, price, images, onVariantRequired]);

  const handleWishlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      productId: product.id,
      name: product.name,
      price: product.price,
      salePrice: product.sale_price ?? undefined,
      image: images[0] || undefined,
      slug: product.slug ?? undefined,
      category: product.category ?? undefined,
    });
  }, [toggleWishlist, product, images]);

  const productUrl = storefrontPath(slug, `product/${product.slug || product.id}`);

  return (
    <Link to={productUrl} className="group relative block overflow-hidden rounded-2xl" style={{ aspectRatio: "3/4" }}>
      {/* Full-bleed image */}
      <img
        src={imgSrc}
        alt={product.name}
        loading={priority ? "eager" : "lazy"}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Wishlist button — top left glassmorphism */}
      <button
        onClick={handleWishlist}
        className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all duration-300"
        style={{
          background: wishlisted ? "rgba(239,68,68,0.85)" : "rgba(255,255,255,0.2)",
          border: "1px solid rgba(255,255,255,0.3)",
        }}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart
          className={`h-4 w-4 transition-all ${wishlisted ? "fill-white text-white" : "text-white"}`}
          strokeWidth={2}
        />
      </button>

      {/* Discount badge — top right */}
      {hasDiscount && discountPercent > 0 && (
        <span
          className="absolute right-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide text-white"
          style={{ background: "var(--storefront-accent, #F56E0F)" }}
        >
          {discountPercent}% OFF
        </span>
      )}

      {/* Product info — bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
        <h3
          className="mb-1.5 text-sm font-semibold leading-tight text-white line-clamp-2"
          style={{ fontFamily: "'Alegreya SC', var(--storefront-heading-font, serif)" }}
        >
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white">
            {currency}{price.toLocaleString("en-IN")}
          </span>
          {hasDiscount && (
            <span className="text-xs text-white/60 line-through">
              {currency}{originalPrice.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </div>

      {/* Add to cart bar — slides up on hover/tap */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all duration-300 translate-y-full group-hover:translate-y-0"
        style={{ background: "var(--storefront-primary, #1B1B3A)" }}
        onClick={handleAddToCart}
      >
        <ShoppingBag className="h-3.5 w-3.5" />
        Add to Cart
      </div>
    </Link>
  );
}
