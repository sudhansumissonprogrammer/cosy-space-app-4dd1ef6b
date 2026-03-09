import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Zap } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

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

  const showWhatsApp = (orderMode === "whatsapp" || orderMode === "both") && !!store.whatsapp_number;
  const showBuyNow = orderMode === "website" || orderMode === "both";

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg">
      {/* Trending / Sale Badge */}
      {product.sale_price && (
        <div className="absolute left-2 top-2 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold text-card">
            <Zap className="h-3 w-3" />
            Trending
          </span>
        </div>
      )}

      {/* Product Image */}
      <Link to={`/store/${slug}/product/${product.slug || product.id}`}>
        <div className="aspect-square w-full overflow-hidden bg-secondary">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-3">
        {/* Category & Rating Row */}
        <div className="mb-1 flex items-center justify-between">
          {product.category ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {product.category}
            </p>
          ) : <span />}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span className="font-semibold">4.5</span>
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

        {/* Action Buttons */}
        <div className="mt-3 flex flex-col gap-2">
          {/* WhatsApp Order Button */}
          {showWhatsApp && (
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-success bg-success/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-success-foreground hover:bg-success/20 transition-colors"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Order on WhatsApp
            </button>
          )}

          {/* Buy Now Button */}
          {showBuyNow && (
            <button
              className="btn-gold inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest"
              onClick={handleBuyNow}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Buy Now
            </button>
          )}

          {/* Add to Cart — always visible */}
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground hover:bg-accent transition-colors"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
