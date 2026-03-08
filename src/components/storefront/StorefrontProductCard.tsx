import { Link } from "react-router-dom";
import { Heart, Package, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

interface StorefrontProductCardProps {
  product: Tables<"products">;
  slug: string;
}

export default function StorefrontProductCard({ product, slug }: StorefrontProductCardProps) {
  const whatsappOrder = () => {
    // Prevent navigation when clicking Add to Cart
  };

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg">
      {/* Wishlist Heart */}
      <button
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm shadow-sm transition-colors hover:bg-card"
        onClick={(e) => e.preventDefault()}
      >
        <Heart className="h-4 w-4 text-muted-foreground transition-colors hover:text-destructive" />
      </button>

      {/* Sale Badge */}
      {product.sale_price && (
        <div className="absolute left-2 top-2 z-10">
          <span className="rounded-sm bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
            Sale
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
      <div className="p-3 text-center">
        {product.category && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {product.category}
          </p>
        )}
        <Link to={`/store/${slug}/product/${product.slug || product.id}`}>
          <h3 className="text-sm font-bold text-foreground line-clamp-2 transition-colors group-hover:text-primary sm:text-base">
            {product.name}
          </h3>
        </Link>
        <div className="mt-2 flex items-center justify-center gap-2">
          {product.sale_price ? (
            <>
              <span className="text-base font-bold text-foreground sm:text-lg">
                ₹{Number(product.sale_price).toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground line-through sm:text-sm">
                ₹{Number(product.price).toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-base font-bold text-foreground sm:text-lg">
              ₹{Number(product.price).toFixed(2)}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <Link to={`/store/${slug}/product/${product.slug || product.id}`}>
          <Button
            size="sm"
            className="mt-3 w-full gap-2 rounded-sm text-xs font-bold uppercase tracking-wide"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Add to Cart
          </Button>
        </Link>
      </div>
    </div>
  );
}
