import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Heart, Zap } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useState } from "react";
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

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-card shadow-sm transition-all duration-300 md:hover:-translate-y-1.5 md:hover:shadow-xl">
      {/* Image Section */}
      <Link to={`/store/${slug}/product/${product.slug || product.id}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-secondary/40 p-2 sm:p-3">
          {/* Trending Badge */}
          {product.sale_price && (
            <div className="absolute left-3 top-3 z-10">
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-card backdrop-blur-md"
                style={{ background: "rgba(0,0,0,0.65)" }}>
                <Zap className="h-3 w-3" />
                Trending
              </span>
            </div>
          )}

          {/* Wishlist Icon */}
          <button
            onClick={handleWishlist}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-md transition-transform duration-300 hover:scale-110"
          >
            <Heart
              className={`h-4 w-4 transition-colors duration-300 ${
                wishlisted ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"
              }`}
            />
          </button>

          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-3 sm:p-4">
        {/* Category & Rating */}
        <div className="mb-1 flex items-center justify-between">
          {product.category ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {product.category}
            </p>
          ) : <span />}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Star className="h-3 w-3 fill-green-500 text-green-500" />
            <span className="font-semibold">{getProductRating(product.id)}</span>
          </div>
        </div>

        {/* Product Name */}
        <Link to={`/store/${slug}/product/${product.slug || product.id}`}>
          <h3 className="text-xs font-bold text-foreground line-clamp-2 transition-colors group-hover:text-primary sm:text-sm">
            {product.name}
          </h3>
        </Link>

        {/* Price Row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {product.sale_price ? (
            <>
              <span className="text-sm font-bold text-foreground sm:text-base">
                ₹{Number(product.sale_price).toFixed(0)}
              </span>
              <span className="text-[11px] text-muted-foreground line-through">
                ₹{Number(product.price).toFixed(0)}
              </span>
              {discountPercent && (
                <span className="rounded-sm bg-success px-1.5 py-0.5 text-[10px] font-bold text-success-foreground">
                  {discountPercent}% off
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-bold text-foreground sm:text-base">
              ₹{Number(product.price).toFixed(0)}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <div className="mt-3">
          <button
            className="btn-gold flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[11px] font-extrabold uppercase tracking-widest transition-transform duration-300 sm:h-12 sm:text-xs md:hover:scale-[1.02]"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}