/**
 * Style 9 — Story Card
 * Inspired by Allbirds, Glossier, Mamaearth. Warm lifestyle, story-led.
 * Wide 4:5 image, rounded-2xl, full-width "Add to bag" button.
 */
import { useState } from "react";
import { createRipple } from "@/lib/ripple";
import { Link } from "react-router-dom";
import { Package, Heart, ShoppingBag, Star, Check, Loader2, Plus, Minus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getDiscountPercent, getProductRating } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { setPdpPreload } from "@/lib/pdpPreload";

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
}

export default function ProductCardStyle9({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const { wishlisted, cartQty, handleAddToCart, handleToggleWishlist, heartBursting, updateQuantity } = useProductCardActions(product);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [hoverLoaded, setHoverLoaded] = useState(false);
  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const currency = store.currency || "₹";

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
      const imgs = resolveProductImages(product);
      setPdpPreload({ slug: product.slug || product.id, image: imgs[0] || "", name: product.name, price: product.price as any, salePrice: (product.sale_price as any) ?? null, currency });
    } catch {}
  };

  return (
    <div
      className="group relative flex flex-col cursor-pointer"
      style={{ contain: priority ? undefined : "layout style", contentVisibility: priority ? undefined : "auto" }}
      onMouseEnter={() => { primePdp(); setHoverLoaded(true); }}
      onTouchStart={primePdp}
      onPointerDown={primePdp}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
        <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: "4 / 5", backgroundColor: "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 6%, var(--storefront-bg, hsl(var(--background))))" }}>
          {(() => {
            const images = resolveProductImages(product);
            if (images.length === 0) return <div className="flex h-full w-full items-center justify-center"><Package className="h-10 w-10 opacity-25" /></div>;
            const hasSecond = images.length > 1;
            return (
              <>
                <img
                  src={optimizeImageUrl(images[0], 400, 75)}
                  srcSet={getImageSrcSet(images[0], [300, 500, 700, 900], 75)}
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, 20vw"
                  alt={product.name}
                  width={400}
                  height={500}
                  data-no-crop="true"
                  className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${hasSecond && hoverLoaded ? "group-hover:opacity-0" : ""}`}
                  loading={priority ? "eager" : "lazy"}
                  decoding={priority ? "sync" : "async"}
                  fetchPriority={priority ? "high" : "low"}
                />
                {hasSecond && hoverLoaded && (
                  <img
                    src={optimizeImageUrl(images[1], 400, 75)}
                    srcSet={getImageSrcSet(images[1], [300, 500, 700, 900], 75)}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, 20vw"
                    alt={product.name}
                    width={400}
                    height={500}
                    data-no-crop="true"
                    className="absolute inset-0 h-full w-full object-cover object-center opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </>
            );
          })()}

          {discountPercent && (
            <div className="absolute left-3 top-3">
              <span className="inline-flex items-center rounded-full bg-background/95 px-2 py-1 text-[10px] font-bold backdrop-blur-sm" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>
                {discountPercent}% off
              </span>
            </div>
          )}

          <button
            onClick={handleToggleWishlist}
            className={`heart-burst ${heartBursting ? "bursting" : ""} absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 backdrop-blur-sm shadow-sm transition-transform hover:scale-110 active:scale-90`}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`h-4 w-4 ${wishlisted ? "fill-destructive text-destructive" : "fill-transparent text-foreground stroke-[2]"}`} />
          </button>
        </div>
      </Link>

      <div className="mt-3 px-0.5 flex-1 flex flex-col">
        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
          <h3 className="text-[14px] font-semibold leading-snug line-clamp-1" style={{ color: "var(--storefront-text, hsl(var(--foreground)))", fontFamily: "var(--storefront-heading-font, inherit)" }}>
            {product.name}
          </h3>
          {(product as any).short_description && (
            <p className="mt-0.5 text-[11px] line-clamp-1" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
              {(product as any).short_description}
            </p>
          )}
        </Link>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            {product.sale_price ? (
              <>
                <span className="text-[14px] font-bold whitespace-nowrap" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{currency}{Number(product.sale_price).toFixed(0)}</span>
                <span className="text-[11px] line-through" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 45%, transparent)" }}>{currency}{Number(product.price).toFixed(0)}</span>
              </>
            ) : (
              <span className="text-[14px] font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{currency}{Number(product.price).toFixed(0)}</span>
            )}
          </div>
          <span className="flex items-center gap-0.5 text-[10px] font-semibold whitespace-nowrap" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 65%, transparent)" }}>
            <Star className="h-3 w-3 fill-warning text-warning" />
            {getProductRating(product.id)}
          </span>
        </div>

        <div className="mt-2.5">
          {cartQty > 0 && !isAdding && !justAdded ? (
            <div className="flex h-9 w-full items-center rounded-full overflow-hidden" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}>
              <button onClick={handleDecrement} className="flex h-full w-10 items-center justify-center hover:opacity-80 active:scale-90" aria-label="Decrease"><Minus className="h-3.5 w-3.5" strokeWidth={2.5} /></button>
              <span className="flex-1 text-center text-[12px] font-semibold qty-bounce" aria-live="polite">{cartQty} in bag</span>
              <button onClick={handleIncrement} className="flex h-full w-10 items-center justify-center hover:opacity-80 active:scale-90" aria-label="Increase"><Plus className="h-3.5 w-3.5" strokeWidth={2.5} /></button>
            </div>
          ) : (
            <button
              onClick={(e) => { createRipple(e); handleAdd(e); }}
              disabled={isAdding}
              className={`ripple-container flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-[0.97] ${justAdded ? "bg-success text-success-foreground" : ""}`}
              style={justAdded ? undefined : {
                backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
              }}
            >
              {isAdding ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding</>) : justAdded ? (<><Check className="h-3.5 w-3.5" strokeWidth={3} />Added to bag</>) : (<><ShoppingBag className="h-3.5 w-3.5" />Add to bag</>)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
