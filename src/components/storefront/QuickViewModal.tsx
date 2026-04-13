/**
 * QuickViewModal — Popup product preview without leaving the page.
 * Uses ReactDOM.createPortal to escape parent overflow constraints.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, ShoppingCart, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, resolveProductImages } from "@/lib/imageOptimize";
import { getEffectivePrice, getDiscountPercent, formatPrice, getProductRating } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import StarRating from "./StarRating";

interface QuickViewModalProps {
  open: boolean;
  onClose: () => void;
  product: any;
  store: any;
  slug: string;
}

export default function QuickViewModal({ open, onClose, product, store, slug }: QuickViewModalProps) {
  const [imgIdx, setImgIdx] = useState(0);
  const { wishlisted, effectivePrice, handleAddToCart, handleToggleWishlist } = useProductCardActions(product);
  const images = resolveProductImages(product);
  const discount = getDiscountPercent(product.price, product.sale_price);
  const rating = getProductRating(product.id);

  if (!open) return null;

  const mainImg = images[imgIdx] || images[0] || "/placeholder.svg";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl animate-scale-in"
        style={{
          backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
          color: "var(--storefront-text, hsl(var(--foreground)))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110"
          style={{
            backgroundColor: "color-mix(in srgb, var(--storefront-bg, #fff) 80%, transparent)",
            backdropFilter: "blur(8px)",
          }}
          aria-label="Close quick view"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Left: Image */}
          <div className="relative aspect-square overflow-hidden md:rounded-l-2xl">
            <img
              src={optimizeImageUrl(mainImg, 600)}
              alt={product.name}
              className="h-full w-full object-cover"
              loading="eager"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-all"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-all"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.slice(0, 5).map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className="h-10 w-10 rounded-md overflow-hidden border-2 transition-all"
                    style={{
                      borderColor: i === imgIdx
                        ? "var(--storefront-primary, hsl(var(--primary)))"
                        : "transparent",
                      opacity: i === imgIdx ? 1 : 0.6,
                    }}
                  >
                    <img src={optimizeImageUrl(img, 80)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {discount && (
              <div
                className="absolute top-3 left-3 px-2.5 py-1 text-xs font-bold rounded-lg"
                style={{
                  backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                  color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                }}
              >
                -{discount}%
              </div>
            )}
          </div>

          {/* Right: Info */}
          <div className="p-6 flex flex-col gap-4">
            <div>
              <h2
                className="text-xl font-bold leading-tight"
                style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
              >
                {product.name}
              </h2>
              <div className="mt-1.5">
                <StarRating rating={rating} showValue textColor="var(--storefront-text, hsl(var(--foreground)))" />
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold">
                {formatPrice(effectivePrice, store.currency)}
              </span>
              {discount && (
                <span
                  className="text-base line-through"
                  style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 45%, transparent)" }}
                >
                  {formatPrice(product.price, store.currency)}
                </span>
              )}
              {discount && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 15%, transparent)",
                    color: "var(--storefront-primary, hsl(var(--primary)))",
                  }}
                >
                  {discount}% off
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p
                className="text-sm leading-relaxed line-clamp-4"
                style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)" }}
              >
                {product.description}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-auto pt-4">
              <button
                onClick={(e) => { handleAddToCart(e); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-wider transition-all hover:brightness-110 active:scale-[0.97]"
                style={{
                  backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                  color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                  borderRadius: "var(--storefront-button-radius, 0.5rem)",
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </button>
              <button
                onClick={handleToggleWishlist}
                className="flex h-12 w-12 items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95"
                style={{
                  border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 15%, transparent)",
                }}
                aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart
                  className={`h-5 w-5 ${wishlisted ? "fill-current" : ""}`}
                  style={{ color: wishlisted ? "#ef4444" : "var(--storefront-text, hsl(var(--foreground)))" }}
                />
              </button>
            </div>

            {/* View full details link */}
            <Link
              to={storefrontPath(slug, `product/${product.slug || product.id}`)}
              onClick={onClose}
              className="text-center text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
              style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
            >
              View Full Details →
            </Link>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}
