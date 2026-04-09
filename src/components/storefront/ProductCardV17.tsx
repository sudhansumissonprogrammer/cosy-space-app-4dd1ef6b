/**
 * ProductCardV17 — systumm.shop-inspired product card.
 * Clean white bg, heart + quick-add overlays on image,
 * centered product name, 5-star rating, centered price.
 */
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Package, Heart, Star, ShoppingCart } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getProductRating } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";

interface Props {
  product: any;
  slug: string;
  store: any;
  priority?: boolean;
  onVariantRequired?: () => void;
}

export default function ProductCardV17({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const { wishlisted, handleAddToCart, handleToggleWishlist } = useProductCardActions(product);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdding) return;
    if (onVariantRequired) { onVariantRequired(); return; }
    setIsAdding(true);
    handleAddToCart(e);
    setIsAdding(false);
  }, [isAdding, onVariantRequired, handleAddToCart]);

  const images = resolveProductImages(product);
  const hasSecond = images.length > 1;
  const rating = getProductRating(product.id);
  const currency = store?.currency || "Rs.";
  const price = Number(product.sale_price || product.price).toFixed(2);
  const originalPrice = product.sale_price ? Number(product.price).toFixed(2) : null;

  return (
    <div className="group bg-white overflow-hidden cursor-pointer">
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
        {/* Image container */}
        <div className="relative w-full overflow-hidden bg-gray-50" style={{ aspectRatio: "3/4" }}>
          {/* Wishlist button */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleWishlist(e); }}
            className="absolute right-2.5 top-2.5 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm transition-transform hover:scale-110 active:scale-95"
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`h-4 w-4 transition-colors ${wishlisted ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
          </button>

          {/* Quick add button */}
          <button
            onClick={handleAdd}
            className="absolute right-2.5 bottom-2.5 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm transition-transform hover:scale-110 active:scale-95"
            aria-label="Add to cart"
          >
            <ShoppingCart className="h-4 w-4 text-gray-600" />
          </button>

          {images.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center bg-gray-100">
              <Package className="h-10 w-10 text-gray-300" />
            </div>
          ) : (
            <>
              <img
                src={optimizeImageUrl(images[0], 400, 80)}
                srcSet={getImageSrcSet(images[0], [400, 800], 80)}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                alt={product.name}
                width={400}
                height={533}
                className={`h-full w-full object-cover transition-all duration-500 ease-out ${hasSecond ? "group-hover:opacity-0" : "group-hover:scale-105"}`}
                loading={priority ? "eager" : "lazy"}
                decoding={priority ? "sync" : "async"}
                fetchPriority={priority ? "high" : "auto"}
              />
              {hasSecond && (
                <img
                  src={optimizeImageUrl(images[1], 400, 80)}
                  srcSet={getImageSrcSet(images[1], [400, 800], 80)}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  alt={product.name}
                  width={400}
                  height={533}
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </>
          )}
        </div>

        {/* Product info — centered like systumm.shop */}
        <div className="px-2 py-3 text-center space-y-1.5">
          <h3 className="text-xs sm:text-sm font-medium text-gray-800 leading-tight line-clamp-2">
            {product.name}
          </h3>

          {/* Star rating */}
          <div className="flex items-center justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`}
              />
            ))}
          </div>

          {/* Price */}
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-sm font-semibold text-gray-900">
              {currency} {price}
            </span>
            {originalPrice && (
              <span className="text-xs text-gray-400 line-through">
                {currency} {originalPrice}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
