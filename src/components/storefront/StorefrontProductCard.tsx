import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Zap, Heart, Check, Plus, Minus, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";

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
  const { addToCart, items, updateQuantity } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const wishlisted = isWishlisted(product.id);

  const cartItem = items.find((i) => i.productId === product.id && !i.variantId);
  const cartQty = cartItem?.quantity || 0;

  const price = product.sale_price && product.sale_price < product.price
    ? Number(product.sale_price)
    : Number(product.price);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdding) return;
    setIsAdding(true);
    setTimeout(() => {
      addToCart({
        productId: product.id,
        name: product.name,
        price,
        image: product.image_url || undefined,
      });
      setIsAdding(false);
      setJustAdded(true);
      toast.success(`${product.name} added to cart`);
      setTimeout(() => setJustAdded(false), 1500);
    }, 600);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, undefined, cartQty + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, undefined, cartQty - 1);
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
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block p-1 pb-0">
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "3/4" }}>
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
      <div className="px-3 pt-2.5 pb-3 sm:px-3.5 sm:pb-3.5 space-y-1.5">
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
        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)}>
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
        {cartQty > 0 && !isAdding && !justAdded ? (
          /* Quantity controls */
          <div className="flex h-9 sm:h-10 w-full items-center rounded-xl border-2 border-[#b8860b] overflow-hidden bg-gradient-to-r from-[#d4a030]/10 to-[#b8860b]/10">
            <button
              onClick={handleDecrement}
              className="flex h-full w-10 items-center justify-center bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-95"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <span className="flex-1 text-center text-xs font-extrabold text-foreground">{cartQty} in cart</span>
            <button
              onClick={handleIncrement}
              className="flex h-full w-10 items-center justify-center bg-primary/10 text-primary transition-colors hover:bg-primary/20 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest sm:h-10 sm:text-[11px] transition-all duration-300 active:scale-[0.98] ${
              justAdded
                ? "bg-success text-success-foreground"
                : isAdding
                ? "btn-gold opacity-80 cursor-wait"
                : "btn-gold hover:brightness-110"
            }`}
            onClick={handleAddToCart}
            disabled={isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="whitespace-nowrap">Adding...</span>
              </>
            ) : justAdded ? (
              <>
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                <span className="whitespace-nowrap">Added to Cart</span>
              </>
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">ADD TO CART</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
