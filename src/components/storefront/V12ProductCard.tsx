import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Tag } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, PRODUCT_CARD_SIZES } from "@/lib/imageOptimize";
import { getProductRating, getDiscountPercent, formatPrice } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import StarRating from "./StarRating";

interface V12ProductCardProps {
  product: any;
  slug: string;
  index?: number;
}

export default function V12ProductCard({ product, slug, index = 0 }: V12ProductCardProps) {
  const { wishlisted, effectivePrice, handleAddToCart, handleToggleWishlist } = useProductCardActions(product);
  const discount = getDiscountPercent(product.price, product.sale_price);
  const rating = getProductRating(product.id);

  return (
    <Link
      to={storefrontPath(slug, `product/${product.slug || product.id}`)}
      className="group overflow-hidden bg-white transition-all active:scale-[0.98]"
      style={{ borderRadius: "12px", border: "1px solid #f0f0f0" }}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
        {product.image_url ? (
          <img
            src={optimizeImageUrl(product.image_url, 400)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading={index < 4 ? "eager" : "lazy"}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-50">
            <Tag className="h-10 w-10 text-gray-200" />
          </div>
        )}

        {/* Discount badge — top left */}
        {discount && (
          <div
            className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold text-white"
            style={{
              backgroundColor: "var(--storefront-primary, #FF3F6C)",
              borderRadius: "6px",
            }}
          >
            -{discount}%
          </div>
        )}

        {/* Wishlist icon — top right */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90"
          style={{
            backgroundColor: wishlisted ? "#fee2e2" : "rgba(255,255,255,0.92)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
          }}
        >
          <Heart
            className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`}
            style={{ color: wishlisted ? "#ef4444" : "#666" }}
          />
        </button>
      </div>

      {/* Product info */}
      <div className="px-3 pt-2.5 pb-3 space-y-1.5">
        <p
          className="text-[13px] font-medium leading-tight truncate"
          style={{
            color: "var(--storefront-text, #1a1a1a)",
            fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif",
          }}
        >
          {product.name}
        </p>

        <StarRating rating={rating} showValue textColor="var(--storefront-text, #1a1a1a)" />

        {/* Price */}
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
            {formatPrice(effectivePrice)}
          </span>
          {discount && (
            <span className="text-[11px] line-through opacity-40" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
              {formatPrice(product.price)}
            </span>
          )}
        </div>

        {/* Add to Cart button */}
        <button
          onClick={handleAddToCart}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold uppercase tracking-wider transition-all active:scale-95 mt-1"
          style={{
            backgroundColor: "var(--storefront-primary, #FF3F6C)",
            color: "var(--storefront-btn-text, #fff)",
            borderRadius: "var(--storefront-button-radius, 0.5rem)",
          }}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Add to Cart
        </button>
      </div>
    </Link>
  );
}
