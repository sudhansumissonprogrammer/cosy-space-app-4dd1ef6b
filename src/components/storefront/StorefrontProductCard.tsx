import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Heart, Zap } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

function getProductRating(productId: string): number {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const ratings = [4.2, 4.3, 4.3, 4.4, 4.5, 4.5, 4.5, 4.6, 4.6, 4.6, 4.6, 4.7, 4.8, 4.9];
  return ratings[Math.abs(hash) % ratings.length];
}

function getReviewCount(productId: string): number {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 7) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  return 24 + (Math.abs(hash) % 180);
}

interface StorefrontProductCardProps {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
}

export default function StorefrontProductCard({ product, slug, store }: StorefrontProductCardProps) {
  const { addToCart } = useCart();
  const [wishlisted, setWishlisted] = useState(false);

  const price = product.sale_price && product.sale_price < product.price
    ? Number(product.sale_price)
    : Number(product.price);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product.id,
      name: product.name,
      price,
      image: product.image_url || undefined,
    });
    toast.success(`${product.name} added to cart`);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlisted((prev) => !prev);
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
  };

  const discountPercent = product.sale_price && product.sale_price < product.price
    ? Math.round(((Number(product.price) - Number(product.sale_price)) / Number(product.price)) * 100)
    : null;

  const rating = getProductRating(product.id);
  const reviewCount = getReviewCount(product.id);
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.3;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-[0_2px_16px_-4px_hsl(var(--foreground)/0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_32px_-8px_hsl(var(--foreground)/0.16)]">
      {/* Image Section */}
      <Link
        to={`/store/${slug}/product/${product.slug || product.id}`}
        className="relative block overflow-hidden"
      >
        {/* Gradient overlay background */}
        <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-secondary/60 via-secondary/30 to-secondary/60 p-2 sm:p-3">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full rounded-xl object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-secondary">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Trending Badge */}
        {product.sale_price && (
          <div className="absolute left-3 top-3 sm:left-4 sm:top-4 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/75 px-2.5 py-1 text-[10px] font-bold text-card backdrop-blur-md sm:px-3 sm:py-1.5 sm:text-xs">
              <Zap className="h-3 w-3" />
              Trending
            </span>
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={handleWishlist}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-[0_2px_8px_hsl(var(--foreground)/0.1)] backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:shadow-[0_4px_12px_hsl(var(--foreground)/0.15)] sm:h-9 sm:w-9"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={`h-4 w-4 transition-colors duration-200 sm:h-[18px] sm:w-[18px] ${
              wishlisted
                ? "fill-destructive text-destructive"
                : "text-muted-foreground hover:text-destructive"
            }`}
          />
        </button>
      </Link>

      {/* Content Section */}
      <div className="flex flex-1 flex-col gap-2 p-3.5 pt-3 sm:gap-2.5 sm:p-[18px] sm:pt-3.5">
        {/* Category */}
        {product.category && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[11px]">
            {product.category}
          </p>
        )}

        {/* Product Name */}
        <Link to={`/store/${slug}/product/${product.slug || product.id}`}>
          <h3 className="text-sm font-bold leading-snug text-foreground line-clamp-2 transition-colors duration-200 group-hover:text-primary sm:text-[15px]">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                  i < fullStars
                    ? "fill-success text-success"
                    : i === fullStars && hasHalfStar
                    ? "fill-success/50 text-success"
                    : "fill-muted text-muted"
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-foreground">{rating}</span>
          <span className="text-[11px] text-muted-foreground">({reviewCount})</span>
        </div>

        {/* Price Section */}
        <div className="mt-auto flex flex-wrap items-baseline gap-1.5 pt-1">
          {product.sale_price && product.sale_price < product.price ? (
            <>
              <span className="text-lg font-extrabold text-foreground sm:text-xl">
                ₹{Number(product.sale_price).toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground line-through sm:text-sm">
                ₹{Number(product.price).toFixed(0)}
              </span>
              {discountPercent && (
                <span className="ml-0.5 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success sm:text-xs">
                  {discountPercent}% OFF
                </span>
              )}
            </>
          ) : (
            <span className="text-lg font-extrabold text-foreground sm:text-xl">
              ₹{Number(product.price).toFixed(0)}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          className="btn-gold mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-extrabold uppercase tracking-widest transition-all duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] sm:h-12 sm:text-xs"
          onClick={handleAddToCart}
        >
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </button>
      </div>
    </div>
  );
}
