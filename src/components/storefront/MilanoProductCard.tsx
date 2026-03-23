import { Link } from "react-router-dom";
import { withAlpha } from "@/lib/storefrontColors";
import { Heart, ShoppingCart, Tag } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, PRODUCT_CARD_SIZES } from "@/lib/imageOptimize";
import { getProductRating, getDiscountPercent, formatPrice } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import StarRating from "./StarRating";

interface MilanoProductCardProps {
  product: any;
  slug: string;
  index?: number;
}

/**
 * Milano card — visually identical to Style 2 but accepts `any` product type
 * and uses index-based eager loading. Used by theme-specific storefront pages.
 */
export default function MilanoProductCard({ product, slug, index = 0 }: MilanoProductCardProps) {
  const { wishlisted, effectivePrice, handleAddToCart, handleToggleWishlist } = useProductCardActions(product);
  const discount = getDiscountPercent(product.price, product.sale_price);
  const rating = getProductRating(product.id);

  return (
    <Link
      to={storefrontPath(slug, `product/${product.slug || product.id}`)}
      className="group overflow-hidden transition-all active:scale-[0.98]"
      style={{ borderRadius: "12px", backgroundColor: "var(--storefront-bg, #fff)" }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "3/4", borderRadius: "12px" }}>
        {product.image_url ? (
          <img
            src={optimizeImageUrl(product.image_url, 400)}
            srcSet={getImageSrcSet(product.image_url, [300, 400, 600])}
            sizes={PRODUCT_CARD_SIZES}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading={index < 4 ? "eager" : "lazy"}
            fetchPriority={index < 2 ? "high" : "auto"}
            decoding={index < 4 ? "sync" : "async"}
            width={400}
            height={533}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: withAlpha("var(--storefront-primary, #1a1a1a)", "08") }}>
            <Tag className="h-10 w-10" style={{ color: withAlpha("var(--storefront-text, #1a1a1a)", "20") }} />
          </div>
        )}

        {/* Discount badge */}
        {discount && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, #1a1a1a)", color: "var(--storefront-btn-text, #fff)", borderRadius: "6px" }}>
            -{discount}%
          </div>
        )}

        {/* Wishlist + Quick-add icons — bottom-right stack */}
        <div className="absolute bottom-2.5 right-2.5 flex flex-col gap-1.5">
          <button onClick={handleToggleWishlist} className="flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90" style={{ backgroundColor: wishlisted ? "#fee2e2" : "rgba(255,255,255,0.92)", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }} aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}>
            <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} style={{ color: wishlisted ? "#ef4444" : "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
          </button>
          <button onClick={handleAddToCart} className="flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90" style={{ backgroundColor: "var(--storefront-primary, #1a1a1a)", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }} aria-label={`Add ${product.name} to cart`}>
            <ShoppingCart className="h-4 w-4" style={{ color: "var(--storefront-btn-text, #fff)" }} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Product info */}
      <div className="px-2.5 pt-2.5 pb-3 space-y-1">
        <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: "var(--storefront-text, #1a1a1a)", fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif" }}>
          {product.name}
        </p>
        <StarRating rating={rating} />
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="text-[14px] font-bold" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
            {formatPrice(effectivePrice)}
          </span>
          {discount && (
            <span className="text-[11px] line-through opacity-40" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
              {formatPrice(product.price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
