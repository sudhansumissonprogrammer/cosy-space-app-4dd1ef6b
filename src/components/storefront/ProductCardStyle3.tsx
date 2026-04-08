import { Link } from "react-router-dom";
import { createRipple } from "@/lib/ripple";
import { Heart, ShoppingCart, Tag } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages, PRODUCT_CARD_SIZES } from "@/lib/imageOptimize";
import { getProductRating, getDiscountPercent, formatPrice } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import StarRating from "./StarRating";

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
}

/**
 * Style 3 — Clean card with top-right wishlist, discount badge,
 * star rating, price and full-width Add to Cart button.
 */
export default function ProductCardStyle3({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const { wishlisted, effectivePrice, handleAddToCart, handleToggleWishlist } = useProductCardActions(product);
  const discount = getDiscountPercent(product.price, product.sale_price);
  const rating = getProductRating(product.id);

  return (
    <Link
      to={storefrontPath(slug, `product/${product.slug || product.id}`)}
      className="group overflow-hidden bg-card transition-all active:scale-[0.98]"
      style={{ borderRadius: "12px", border: "1px solid #f0f0f0" }}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
        {(() => {
          const images = resolveProductImages(product);
          if (images.length === 0) {
            return (
              <div className="h-full w-full flex items-center justify-center bg-secondary/40">
                <Tag className="h-10 w-10 text-muted-foreground/40" />
              </div>
            );
          }
          const hasSecond = images.length > 1;
          return (
            <>
              <img
                src={optimizeImageUrl(images[0], 400, 80)}
                srcSet={getImageSrcSet(images[0], [400, 800], 80)}
                sizes={PRODUCT_CARD_SIZES}
                alt={product.name}
                width={400}
                height={533}
                className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${hasSecond ? "group-hover:opacity-0" : ""}`}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                decoding={priority ? "sync" : "async"}
              />
              {hasSecond && (
                <img src={optimizeImageUrl(images[1], 400)} srcSet={getImageSrcSet(images[1], [300, 400, 600])} sizes={PRODUCT_CARD_SIZES} alt={product.name} width={400} height={533} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105" loading="lazy" decoding="async" />
              )}
            </>
          );
        })()}
        {discount && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)", borderRadius: "6px" }}>
            -{discount}%
          </div>
        )}
        <button onClick={handleToggleWishlist} className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90" style={{ backgroundColor: wishlisted ? "#fee2e2" : "rgba(255,255,255,0.92)", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }} aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}>
          <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} style={{ color: wishlisted ? "#ef4444" : "#666" }} aria-hidden="true" />
        </button>
      </div>

      <div className="px-3 pt-2.5 pb-3 space-y-1.5">
        <p className="text-[13px] font-medium leading-tight truncate" style={{ color: "var(--storefront-text, #1a1a1a)", fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif" }}>
          {product.name}
        </p>
        <StarRating rating={rating} showValue textColor="var(--storefront-text, #1a1a1a)" />
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
            {formatPrice(effectivePrice, store.currency)}
          </span>
          {discount && (
            <span className="text-[11px] line-through opacity-40" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
              {formatPrice(product.price, store.currency)}
            </span>
          )}
        </div>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); createRipple(e); if (onVariantRequired) { onVariantRequired(); return; } handleAddToCart(e); }} className="ripple-container w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold uppercase tracking-wider transition-all active:scale-95 mt-1" style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)", color: "var(--storefront-btn-text, #fff)", borderRadius: "var(--storefront-button-radius, 0.5rem)" }} aria-label={`Add ${product.name} to cart`}>
          <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
          Add to Cart
        </button>
      </div>
    </Link>
  );
}
