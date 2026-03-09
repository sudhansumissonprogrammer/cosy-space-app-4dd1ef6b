import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Zap } from "lucide-react";
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

interface StorefrontProductCardProps {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
}

export default function StorefrontProductCard({ product, slug, store }: StorefrontProductCardProps) {
  const { addToCart } = useCart();

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

  const discountPercent = product.sale_price && product.sale_price < product.price
    ? Math.round(((Number(product.price) - Number(product.sale_price)) / Number(product.price)) * 100)
    : null;

  const categoryLabel = product.category || "TOP RATED";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Image */}
      <Link to={`/store/${slug}/product/${product.slug || product.id}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-secondary/30 p-2.5">
          {/* Trending Badge */}
          {product.sale_price && (
            <div className="absolute left-4 top-4 z-10">
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[11px] font-bold text-card">
                <Zap className="h-3 w-3" />
                Trending
              </span>
            </div>
          )}

          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full rounded-xl object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="px-3 pb-3 pt-2.5">
        {/* Category & Rating */}
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {categoryLabel}
          </p>
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-green-500 text-green-500" />
            <span className="text-[11px] font-semibold text-foreground">{getProductRating(product.id)}</span>
          </div>
        </div>

        {/* Name */}
        <Link to={`/store/${slug}/product/${product.slug || product.id}`}>
          <h3 className="text-[13px] font-bold leading-snug text-foreground line-clamp-2 sm:text-sm">
            {product.name}
          </h3>
        </Link>

        {/* Price */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {product.sale_price ? (
            <>
              <span className="text-base font-extrabold text-foreground">
                ₹{Number(product.sale_price).toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                ₹{Number(product.price).toFixed(0)}
              </span>
              {discountPercent && (
                <span className="rounded bg-success px-1.5 py-0.5 text-[10px] font-bold text-success-foreground">
                  {discountPercent}% off
                </span>
              )}
            </>
          ) : (
            <span className="text-base font-extrabold text-foreground">
              ₹{Number(product.price).toFixed(0)}
            </span>
          )}
        </div>

        {/* Add to Cart */}
        <div className="mt-3">
          <button
            className="btn-gold flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[11px] font-extrabold uppercase tracking-widest"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-4 w-4" />
            ADD TO CART
          </button>
        </div>
      </div>
    </div>
  );
}
