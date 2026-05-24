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
import { setPdpPreload } from "@/lib/pdpPreload";
import { resolveProductImages as _resolve } from "@/lib/imageOptimize";
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
  const [hoverLoaded, setHoverLoaded] = useState(false);
  const themeConfig = useStorefrontThemeConfig(store.id);
  const bilingualCta = ((store as any).theme === "theme-16" || (store as any).theme === "theme-21") && !!themeConfig?.bilingual_cta;

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

  const primePdp = () => {
    prefetchProductDetail();
    try {
      const imgs = _resolve(product);
      setPdpPreload({
        slug: product.slug || product.id,
        image: imgs[0] || "",
        name: product.name,
        price: product.price as any,
        salePrice: (product.sale_price as any) ?? null,
        currency: (store as any).currency || "₹",
      });
    } catch {}
  };

  return (
    <div
      className="card-tilt group relative overflow-hidden rounded-2xl transition-all duration-300 ease-out cursor-pointer"
      style={{ boxShadow: cardShadow, contain: priority ? undefined : "layout style", contentVisibility: priority ? undefined : "auto", backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 10%, transparent)" }}
      onMouseEnter={(e) => { primePdp(); setHoverLoaded(true); e.currentTarget.style.boxShadow = cardHoverShadow; }}
      onTouchStart={primePdp}
      onPointerDown={primePdp}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = cardShadow; }}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block p-1 pb-0">
        <div
          className="card-img-zoom relative isolate w-full overflow-hidden rounded-[8px]"
          style={{
            aspectRatio: "3 / 4",
            backgroundColor: imageStageBackground,
          }}
        >
          {discountPercent && (
            <div className="absolute top-2 z-10" style={{ left: "0.5rem", right: "auto" }}>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[8px] font-bold text-destructive-foreground shadow-sm">
                -{discountPercent}%
              </span>
            </div>
          )}
          <button onClick={handleToggleWishlist} className={`heart-burst ${heartBursting ? "bursting" : ""} absolute top-2 z-10 flex items-center justify-center p-1 transition-all duration-200 hover:scale-110 active:scale-95 lg:hidden`} style={{ left: "auto", right: "0.5rem", color: "hsl(var(--destructive))", background: "transparent", border: "none", boxShadow: "none", backdropFilter: "none", WebkitBackdropFilter: "none" }} aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}>
            <Heart className={`h-[20px] w-[20px] transition-colors duration-200 ${wishlisted ? "fill-destructive text-destructive" : "fill-transparent text-white stroke-[2.25]"}`} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }} aria-hidden="true" />
          </button>
          {(() => {
            const images = resolveProductImages(product);
            if (images.length === 0) {
              return <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: imageStageBackground }}><Package className="h-10 w-10" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 20%, transparent)" }} /></div>;
            }
            const hasSecond = images.length > 1;
            return (
              <>
                <img src={optimizeImageUrl(images[0], 400, 72)} srcSet={getImageSrcSet(images[0], [300, 500, 700, 900], 72)} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, (max-width: 1440px) 20vw, 16vw" alt={product.name} width={400} height={533} data-no-crop="true" className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-500 ease-out ${hasSecond && hoverLoaded ? "group-hover:opacity-0" : ""}`} loading={priority ? "eager" : "lazy"} decoding={priority ? "sync" : "async"} fetchPriority={priority ? "high" : "low"} />
                {hasSecond && hoverLoaded && (
                  <img src={optimizeImageUrl(images[1], 400, 72)} srcSet={getImageSrcSet(images[1], [300, 500, 700, 900], 72)} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, (max-width: 1440px) 20vw, 16vw" alt={product.name} width={400} height={533} data-no-crop="true" className="absolute inset-0 h-full w-full object-cover object-center opacity-0 transition-all duration-500 ease-out group-hover:opacity-100" loading="lazy" decoding="async" fetchPriority="low" />
                )}
              </>
            );
          })()}
        </div>
      </Link>
      <div className="px-3 pt-2 pb-3 sm:px-3.5 sm:pb-3.5 space-y-1">
        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
          <div className="flex items-start justify-between gap-2 border-b pb-1.5" style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 10%, transparent)" }}>
            <h3 className="flex-1 text-[13px] font-semibold leading-tight line-clamp-1 transition-colors duration-200" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{product.name}</h3>
            <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
              <Star className="h-3 w-3 fill-warning text-warning" />
              <span className="text-[10px] font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{getProductRating(product.id)}</span>
            </div>
          </div>
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
            {isAdding ? (<><Loader2 className="h-3 w-3 animate-spin" /><span className="whitespace-nowrap">Adding...</span></>) : justAdded ? (<><Check className="h-3 w-3" strokeWidth={3} /><span className="whitespace-nowrap">Added ✓</span></>) : (<><ShoppingCart className="h-3 w-3" /><span className="whitespace-nowrap">Add to Cart</span></>)}
          </button>
        )}
      </div>
    </div>
  );
}
