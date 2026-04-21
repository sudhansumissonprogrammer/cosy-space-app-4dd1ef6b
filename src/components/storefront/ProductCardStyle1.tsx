import { useState } from "react";
import { createRipple } from "@/lib/ripple";
import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Heart, Check, Plus, Minus, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getProductRating, getDiscountPercent } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";


interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
  
}

const cardShadow = "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)";
const cardHoverShadow = "0 2px 8px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.10)";

export default function ProductCardStyle1({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const { wishlisted, cartQty, effectivePrice, handleAddToCart, handleToggleWishlist, heartBursting, updateQuantity } = useProductCardActions(product);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const themeConfig = useStorefrontThemeConfig(store.id);
  const bilingualCta = (store as any).theme === "theme-16" && !!themeConfig?.bilingual_cta;

  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const imageStageBackground = "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 3%, var(--storefront-bg, hsl(var(--background))))";
  const iconChrome = "color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 92%, transparent)";

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdding) return;
    if (onVariantRequired) { onVariantRequired(); return; }
    setIsAdding(true);
    handleAddToCart(e);
    setIsAdding(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const handleIncrement = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty + 1); };
  const handleDecrement = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty - 1); };

  return (
    <div
      className="card-tilt group relative overflow-hidden rounded-2xl transition-all duration-300 ease-out cursor-pointer"
      style={{ boxShadow: cardShadow, contain: priority ? undefined : "layout style", contentVisibility: priority ? undefined : "auto", backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 10%, transparent)" }}
      onMouseEnter={(e) => { prefetchProductDetail(); e.currentTarget.style.boxShadow = cardHoverShadow; }}
      onTouchStart={prefetchProductDetail}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = cardShadow; }}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block p-1.5 pb-0">
        <div
          className="card-img-zoom relative isolate w-full overflow-hidden rounded-[18px]"
          style={{
            aspectRatio: "1 / 1.04",
            backgroundColor: imageStageBackground,
          }}
        >
          {discountPercent && (
            <div className="absolute left-2 top-2 z-10">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[8px] font-bold text-destructive-foreground shadow-sm">
                -{discountPercent}%
              </span>
            </div>
          )}
          <button onClick={handleToggleWishlist} className={`heart-burst ${heartBursting ? "bursting" : ""} absolute right-2 top-2 z-10 rounded-full p-1.5 transition-all duration-200 hover:scale-110 active:scale-95 lg:hidden`} style={{ color: "hsl(var(--destructive))", backgroundColor: iconChrome, boxShadow: "0 1px 4px color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)" }} aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}>
            <Heart className={`h-4 w-4 drop-shadow-sm transition-colors duration-200 ${wishlisted ? "fill-destructive text-destructive" : "fill-transparent text-card-foreground stroke-[2.25]"}`} aria-hidden="true" />
          </button>
          {(() => {
            const images = resolveProductImages(product);
            if (images.length === 0) {
              return <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: imageStageBackground }}><Package className="h-10 w-10" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 20%, transparent)" }} /></div>;
            }
            const hasSecond = images.length > 1;
            return (
              <>
                <div className="absolute inset-0 flex items-center justify-center p-2.5 sm:p-3">
                  <img src={optimizeImageUrl(images[0], 400, 80)} srcSet={getImageSrcSet(images[0], [400, 800], 80)} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" alt={product.name} width={400} height={500} data-no-crop="true" className={`max-h-full max-w-full h-auto w-auto object-contain object-center transition-all duration-500 ease-out ${hasSecond ? "group-hover:opacity-0" : ""}`} loading={priority ? "eager" : "lazy"} decoding={priority ? "sync" : "async"} fetchPriority={priority ? "high" : "auto"} />
                </div>
                {hasSecond && (
                  <div className="absolute inset-0 flex items-center justify-center p-2.5 opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 sm:p-3">
                    <img src={optimizeImageUrl(images[1], 400, 80)} srcSet={getImageSrcSet(images[1], [400, 800], 80)} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" alt={product.name} width={400} height={500} data-no-crop="true" className="max-h-full max-w-full h-auto w-auto object-contain object-center" loading="lazy" decoding="async" />
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </Link>
      <div className="px-3 pt-2 pb-3 sm:px-3.5 sm:pb-3.5 space-y-1.5">
        <div className="flex items-center justify-end border-b pb-1.5" style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 10%, transparent)" }}>
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span className="text-[10px] font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{getProductRating(product.id)}</span>
          </div>
        </div>
        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)}>
          <h3 className="text-[13px] font-semibold leading-tight line-clamp-2 transition-colors duration-200" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{product.name}</h3>
        </Link>
        <div className="flex items-center gap-1 min-w-0">
          {product.sale_price ? (
            <>
              <span className="text-sm sm:text-base font-semibold whitespace-nowrap" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{store.currency || "₹"}{Number(product.sale_price).toFixed(0)}</span>
              <span className="price-strike-draw text-[10px] sm:text-xs whitespace-nowrap" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>{store.currency || "₹"}{Number(product.price).toFixed(0)}</span>
              {discountPercent && <span className="rounded-full bg-success px-1 py-0.5 text-[8px] font-bold text-success-foreground whitespace-nowrap shrink-0">{discountPercent}% off</span>}
            </>
          ) : (
            <span className="text-sm sm:text-base font-semibold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{store.currency || "₹"}{Number(product.price).toFixed(0)}</span>
          )}
        </div>
        {cartQty > 0 && !isAdding && !justAdded ? (
          <div className="flex h-7 sm:h-7 w-full items-center rounded-md overflow-hidden" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))", borderRadius: "var(--storefront-button-radius, 0.375rem)" }}>
            <button onClick={handleDecrement} className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-90" aria-label="Decrease quantity"><Minus className="h-3 w-3" strokeWidth={2.5} /></button>
            <span key={cartQty} className="flex-1 text-center text-[10px] font-semibold whitespace-nowrap qty-bounce" style={{ fontFamily: "'Alegreya SC', serif" }} aria-live="polite">{cartQty} in cart</span>
            <button onClick={handleIncrement} className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-90" aria-label="Increase quantity"><Plus className="h-3 w-3" strokeWidth={2.5} /></button>
          </div>
        ) : (
          <button
            className={`ripple-container flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-[10px] uppercase tracking-wider sm:h-7 sm:text-[10px] transition-all duration-300 active:scale-[0.95] ${justAdded ? "bg-success text-success-foreground" : isAdding ? "opacity-80 cursor-wait" : "hover:brightness-110"}`}
            style={
              justAdded
                ? { fontFamily: "'Alegreya SC', serif", fontWeight: 500, letterSpacing: "0.06em" }
                : {
                    backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                    color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                    borderRadius: "var(--storefront-button-radius, 0.375rem)",
                    fontFamily: "'Alegreya SC', serif",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                  }
            }
            onClick={(e) => { createRipple(e); handleAdd(e); }}
            disabled={isAdding}
          >
            {isAdding ? (<><Loader2 className="h-3 w-3 animate-spin" /><span className="whitespace-nowrap">Adding...</span></>) : justAdded ? (<><Check className="h-3 w-3" strokeWidth={3} /><span className="whitespace-nowrap">Added ✓</span></>) : (<><ShoppingCart className="h-3 w-3" /><span className="whitespace-nowrap">{bilingualCta ? "Add to Cart / कार्ट में जोड़ें" : "Add to Cart"}</span></>)}
          </button>
        )}
      </div>
    </div>
  );
}
