import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Zap, Heart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
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

interface StorefrontProductCardProps {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
}

const cardShadow = "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)";
const cardHoverShadow = "0 2px 8px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.10)";

export default function StorefrontProductCard({ product, slug, store }: StorefrontProductCardProps) {
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const wishlisted = isWishlisted(product.id);

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
    toggleWishlist({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      salePrice: product.sale_price ? Number(product.sale_price) : undefined,
      image: product.image_url || undefined,
      slug: product.slug || product.id,
      category: product.category || undefined,
    });
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
  };

  const discountPercent = product.sale_price && product.sale_price < product.price
    ? Math.round(((Number(product.price) - Number(product.sale_price)) / Number(product.price)) * 100)
    : null;

  const categoryLabel = product.category || "TOP RATED";

  return (
    <div
      className="group rounded-xl bg-card overflow-hidden border border-border/50 transition-all duration-300 ease-out cursor-pointer"
      style={{ boxShadow: cardShadow }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = cardHoverShadow;
        e.currentTarget.style.transform = "translateY(-4px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = cardShadow;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Image */}
      <Link to={`/store/${slug}/product/${product.slug || product.id}`} className="block">
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "3/4" }}>
          {/* Trending Badge */}
          {product.sale_price && (
            <div className="absolute left-2 top-2 z-10">
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-card">
                <Zap className="h-3 w-3" />
                Trending
              </span>
            </div>
          )}

          {/* Wishlist Heart */}
          <button
            onClick={handleWishlist}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm shadow-sm transition-all duration-200 hover:scale-110 hover:bg-card"
          >
            <Heart
              className={`h-4 w-4 transition-colors duration-200 ${
                wishlisted ? "fill-destructive text-destructive" : "text-muted-foreground"
              }`}
            />
          </button>

          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary/40">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="px-3 pt-3 pb-3 sm:px-4 sm:pb-4 space-y-1.5">
        {/* Category & Rating */}
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {categoryLabel}
          </p>
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-semibold text-foreground">{getProductRating(product.id)}</span>
          </div>
        </div>

        {/* Name */}
        <Link to={`/store/${slug}/product/${product.slug || product.id}`}>
          <h3 className="text-xs font-bold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200">
            {product.name}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex flex-wrap items-center gap-1.5">
          {product.sale_price ? (
            <>
              <span className="text-sm font-extrabold text-foreground">
                ₹{Number(product.sale_price).toFixed(0)}
              </span>
              <span className="text-[10px] text-muted-foreground line-through">
                ₹{Number(product.price).toFixed(0)}
              </span>
              {discountPercent && (
                <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-bold text-success">
                  {discountPercent}% off
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-extrabold text-foreground">
              ₹{Number(product.price).toFixed(0)}
            </span>
          )}
        </div>

        {/* Add to Cart */}
        <button
          className="btn-gold flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest sm:h-10 sm:text-[11px] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          onClick={handleAddToCart}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          <span className="whitespace-nowrap">ADD TO CART</span>
        </button>
      </div>
    </div>
  );
}
