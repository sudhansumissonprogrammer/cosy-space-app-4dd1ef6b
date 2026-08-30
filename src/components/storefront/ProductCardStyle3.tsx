import { useState } from "react";
import { Link } from "react-router-dom";
import { createRipple } from "@/lib/ripple";
import { Heart, ShoppingCart, Tag } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages, PRODUCT_CARD_SIZES } from "@/lib/imageOptimize";
import { getProductRating, getDiscountPercent, formatPrice } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import StarRating from "./StarRating";
import ProductCardTitle from "./ProductCardTitle";
import WishlistHeartButton from "./WishlistHeartButton";
import { memo } from "react";
import { productCardPropsEqual } from "./cardMemo";



interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
  
}

function ProductCardStyle3Impl({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const [hoverLoaded, setHoverLoaded] = useState(false);
  const { wishlisted, effectivePrice, handleAddToCart, handleToggleWishlist } = useProductCardActions(product);
  const discount = getDiscountPercent(product.price, product.sale_price);
  const rating = getProductRating(product.id);
  const isOutOfStock = (product.stock_quantity ?? 0) <= 0;

  return (
    <div onMouseEnter={() => setHoverLoaded(true)} className="card-tilt group relative overflow-hidden transition-[transform,opacity,colors,box-shadow] active:scale-[0.98]" style={{ borderRadius: "12px", border: "1px solid hsl(var(--border, 0 0% 90%))" }}>
      <Link
        to={storefrontPath(slug, `product/${product.slug || product.id}`)}
        className="block"
      >
        <div className="card-img-zoom relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
          {(() => {
            const images = resolveProductImages(product);
            if (images.length === 0) {
              return (
                <div className="h-full w-full flex items-center justify-center bg-secondary/40">
                  <Tag className="h-10 w-10" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 30%, transparent)" }} />
                </div>
              );
            }
            const hasSecond = images.length > 1;
            return (
              <>
                <img
                  src={optimizeImageUrl(images[0], 400, 72)}
                  srcSet={getImageSrcSet(images[0], [300, 500, 700, 900], 72)}
                  sizes={PRODUCT_CARD_SIZES}
                  alt={product.name}
                  width={400}
                  height={533}
                  className={`h-full w-full object-cover transition-[transform,opacity,colors,box-shadow] duration-300 hh:group-hover:scale-105 ${hasSecond && hoverLoaded ? "group-hover:opacity-0" : ""}`}
                  loading={priority ? "eager" : "lazy"}
                  fetchPriority={priority ? "high" : "low"}
                  decoding={priority ? "sync" : "async"}
                />
                {hasSecond && hoverLoaded && (
                  <img src={optimizeImageUrl(images[1], 400, 72)} srcSet={getImageSrcSet(images[1], [300, 500, 700, 900], 72)} sizes={PRODUCT_CARD_SIZES} alt={product.name} width={400} height={533} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-[transform,opacity,colors,box-shadow] duration-300 group-hover:opacity-100 hh:group-hover:scale-105" loading="lazy" decoding="async" fetchPriority="low" />
                )}
              </>
            );
          })()}
          {isOutOfStock && (
            <>
              <div className="absolute inset-0 bg-background/55" aria-hidden="true" />
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-foreground text-background">
                Sold Out
              </div>
            </>
          )}
          <WishlistHeartButton wishlisted={wishlisted} onClick={handleToggleWishlist} size={32} className="absolute top-2.5 right-2.5 lg:hidden" />

        </div>

        <div className="px-3 pt-2.5 pb-3 space-y-1.5">
          <ProductCardTitle name={product.name} className="font-medium" baseSize={13} minSize={10} style={{ color: "var(--storefront-text, hsl(var(--foreground)))", fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif" }} />

          <StarRating rating={rating} showValue textColor="var(--storefront-text, hsl(var(--foreground)))" />
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
              {formatPrice(effectivePrice, store.currency)}
            </span>
            {discount && (
              <span className="price-strike-draw text-[11px] opacity-40" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                {formatPrice(product.price, store.currency)}
              </span>
            )}
          </div>
        </div>
      </Link>
      {/* Add to Cart button — outside Link */}
      <div className="px-3 pb-3">
        <button disabled={isOutOfStock} onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (isOutOfStock) return; createRipple(e); if (onVariantRequired) { onVariantRequired(); return; } handleAddToCart(e); }} className="ripple-container w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium uppercase tracking-wider transition-[transform,opacity,colors,box-shadow] active:scale-95 disabled:cursor-not-allowed" style={isOutOfStock ? { backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)", color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)", borderRadius: "var(--storefront-button-radius, 0.5rem)" } : { backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))", borderRadius: "var(--storefront-button-radius, 0.5rem)" }} aria-label={isOutOfStock ? `${product.name} is sold out` : `Add ${product.name} to cart`}>
          {!isOutOfStock && <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
          {isOutOfStock ? "Sold Out" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

const ProductCardStyle3 = memo(ProductCardStyle3Impl, productCardPropsEqual);
export default ProductCardStyle3;
