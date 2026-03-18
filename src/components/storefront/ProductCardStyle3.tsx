import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Tag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, splitImageUrls } from "@/lib/imageOptimize";

function getProductRating(productId: string): number {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const ratings = [4.2, 4.3, 4.4, 4.5, 4.5, 4.6, 4.6, 4.7, 4.8, 4.9];
  return ratings[Math.abs(hash) % ratings.length];
}

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
}

/**
 * Style 3 — Clean card with top-right wishlist, discount badge, 
 * star rating, price and full-width Add to Cart button.
 */
export default function ProductCardStyle3({ product, slug, store, priority = false }: Props) {
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  const effectivePrice = product.sale_price && product.sale_price < product.price ? product.sale_price : product.price;
  const discount = product.sale_price && product.sale_price < product.price
    ? Math.round(((Number(product.price) - Number(product.sale_price)) / Number(product.price)) * 100)
    : null;

  const rating = getProductRating(product.id);
  const fullStars = Math.floor(rating);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({ productId: product.id, name: product.name, price: Number(effectivePrice), image: product.image_url || undefined, quantity: 1 });
    toast.success(`${product.name} added to cart`);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({ productId: product.id, name: product.name, price: Number(product.price), salePrice: product.sale_price ? Number(product.sale_price) : undefined, image: product.image_url || undefined, slug: product.slug || product.id });
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
  };

  return (
    <Link
      to={storefrontPath(slug, `product/${product.slug || product.id}`)}
      className="group overflow-hidden bg-card transition-all active:scale-[0.98]"
      style={{ borderRadius: "12px", border: "1px solid hsl(var(--border) / 0.5)" }}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
        {product.image_url ? (
          <img src={optimizeImageUrl(product.image_url, 400)} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading={priority ? "eager" : "lazy"} />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-secondary/30">
            <Tag className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {discount && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)", borderRadius: "6px" }}>
            -{discount}%
          </div>
        )}
        <button onClick={handleToggleWishlist} className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90" style={{ backgroundColor: wishlisted ? "#fee2e2" : "rgba(255,255,255,0.92)", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>
          <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} style={{ color: wishlisted ? "#ef4444" : "#666" }} />
        </button>
      </div>
      <div className="px-3 pt-2.5 pb-3 space-y-1.5">
        <p className="text-[13px] font-medium leading-tight truncate" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
          {product.name}
        </p>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="h-3 w-3" viewBox="0 0 20 20" fill={i < fullStars ? "#FFD700" : "#e0e0e0"}>
                <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
              </svg>
            ))}
          </div>
          <span className="text-[10px] opacity-50" style={{ color: "var(--storefront-text, #1a1a1a)" }}>{rating}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
            {store.currency || "₹"}{Number(effectivePrice).toLocaleString("en-IN")}
          </span>
          {product.sale_price && product.sale_price < product.price && (
            <span className="text-[11px] line-through opacity-40" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
              {store.currency || "₹"}{Number(product.price).toLocaleString("en-IN")}
            </span>
          )}
        </div>
        <button onClick={handleAddToCart} className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold uppercase tracking-wider transition-all active:scale-95 mt-1" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)", color: "var(--storefront-btn-text, #fff)", borderRadius: "var(--storefront-button-radius, 0.5rem)" }}>
          <ShoppingCart className="h-3.5 w-3.5" />
          Add to Cart
        </button>
      </div>
    </Link>
  );
}
