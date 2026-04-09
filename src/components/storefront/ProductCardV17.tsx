/**
 * ProductCardV17 — systumm.shop-exact product card.
 * Rounded image (8px), 3:4 aspect ratio, circle wishlist + quickbuy buttons,
 * centered capitalize product name (15px/500), green stars, centered price (15px/500).
 */
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Package, Heart, ShoppingCart } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getProductRating } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";

/* systumm.shop exact colors */
const STAR_COLOR = "#1B5E4B";
const STAR_EMPTY = "#d4d4d4";

/* systumm.shop star SVG — filled solid star matching Judge.me */
function SystummStar({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? STAR_COLOR : STAR_EMPTY} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

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
  const price = Number(product.sale_price || product.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const originalPrice = product.sale_price
    ? Number(product.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  return (
    <div className="group overflow-hidden cursor-pointer" style={{ fontFamily: "var(--v17-body-font, 'Jost', sans-serif)" }}>
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
        {/* Image container — 3:4 ratio, rounded 8px like systumm */}
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "3/4", backgroundColor: "#f5f5f0" }}>
          {/* Wishlist button — circle, white, shadow, right-top */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleWishlist(e); }}
            className="absolute z-10 flex items-center justify-center rounded-full bg-white shadow-md transition-transform hover:scale-110 active:scale-95"
            style={{ width: "36px", height: "36px", right: "10px", top: "auto", bottom: "52px" }}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className="transition-colors"
              style={{
                width: "14px",
                height: "14px",
                fill: wishlisted ? "#e53e3e" : "none",
                color: wishlisted ? "#e53e3e" : "#333",
                strokeWidth: 1.5,
              }}
            />
          </button>

          {/* Quick-add button — circle, white, shadow, right-bottom */}
          <button
            onClick={handleAdd}
            className="absolute z-10 flex items-center justify-center rounded-full bg-white shadow-md transition-transform hover:scale-110 active:scale-95"
            style={{ width: "36px", height: "36px", right: "10px", bottom: "10px" }}
            aria-label="Add to cart"
          >
            {/* systumm uses a bag/compare icon — using cart icon */}
            <ShoppingCart style={{ width: "14px", height: "14px", color: "#333", strokeWidth: 1.5 }} />
          </button>

          {images.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "#f0f0eb" }}>
              <Package className="h-10 w-10" style={{ color: "#ccc" }} />
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
                className={`h-full w-full object-cover transition-all duration-500 ease-out ${hasSecond ? "group-hover:opacity-0" : "group-hover:scale-[1.07]"}`}
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
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-[1.07]"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </>
          )}
        </div>

        {/* Product info — centered, systumm exact sizing */}
        <div className="text-center" style={{ marginTop: "15px" }}>
          {/* Product name: 15px, weight 500, capitalize, line-clamp 2 */}
          <h3
            className="line-clamp-2"
            style={{
              fontSize: "15px",
              fontWeight: 500,
              lineHeight: 1.3,
              color: "#1a1a1a",
              textTransform: "capitalize",
              fontFamily: "var(--v17-heading-font, 'Cormorant Garamond', serif)",
            }}
          >
            {product.name}
          </h3>

          {/* Star rating — green filled stars like systumm/Judge.me */}
          <div className="flex items-center justify-center gap-0.5" style={{ marginTop: "6px" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SystummStar key={i} filled={i < Math.round(rating)} />
            ))}
          </div>

          {/* Price: 15px, weight 500 */}
          <div className="flex items-center justify-center gap-1.5" style={{ marginTop: "6px" }}>
            <span style={{ fontSize: "15px", fontWeight: 500, color: "#1a1a1a" }}>
              {currency} {price}
            </span>
            {originalPrice && (
              <span style={{ fontSize: "13px", fontWeight: 400, color: "#999", textDecoration: "line-through" }}>
                {currency} {originalPrice}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
