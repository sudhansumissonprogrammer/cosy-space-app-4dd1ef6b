/**
 * Style 10 — Catalog Pro
 * Inspired by IKEA, Zara, Decathlon. Professional, info-rich, conversion.
 * Multi-badge stack, hover image swap, you-save text, cart + heart side-by-side.
 */
import { useState } from "react";
import { createRipple } from "@/lib/ripple";
import { Link } from "react-router-dom";
import { Package, Heart, ShoppingCart, Check, Loader2, Plus, Minus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getDiscountPercent } from "@/lib/productUtils";
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

export default function ProductCardStyle10({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const { wishlisted, cartQty, handleAddToCart, handleToggleWishlist, heartBursting, updateQuantity } = useProductCardActions(product);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [hoverLoaded, setHoverLoaded] = useState(false);
  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const currency = store.currency || "₹";
  const savings = product.sale_price ? Math.round(Number(product.price) - Number(product.sale_price)) : 0;
  const isNew = (() => {
    const createdAt = (product as any).created_at;
    if (!createdAt) return false;
    return (Date.now() - new Date(createdAt).getTime()) < 14 * 24 * 60 * 60 * 1000;
  })();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdding) return;
    if (onVariantRequired) { onVariantRequired(); return; }
    setIsAdding(true);
    handleAddToCart(e);
    setIsAdding(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1100);
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
      className="group relative flex flex-col rounded-lg overflow-hidden cursor-pointer transition-shadow hover:shadow-lg"
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
        border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)",
        contain: priority ? undefined : "layout style",
        contentVisibility: priority ? undefined : "auto",
      }}
      onMouseEnter={() => { primePdp(); setHoverLoaded(true); }}
      onTouchStart={primePdp}
      onPointerDown={primePdp}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "1 / 1", backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 3%, transparent)" }}>
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
                  height={400}
                  data-no-crop="true"
                  className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${hasSecond && hoverLoaded ? "group-hover:opacity-0" : "group-hover:scale-105"}`}
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
                    height={400}
                    data-no-crop="true"
                    className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </>
            );
          })()}

          {/* Badge stack top-left */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {isNew && (
              <span className="inline-block rounded bg-foreground/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background shadow-sm">NEW</span>
            )}
            {discountPercent && (
              <span className="inline-block rounded bg-destructive px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive-foreground shadow-sm">−{discountPercent}%</span>
            )}
            {((product as any).featured) && (
              <span className="inline-block rounded bg-warning px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning-foreground shadow-sm">TOP</span>
            )}
          </div>

          <button
            onClick={handleToggleWishlist}
            className={`heart-burst ${heartBursting ? "bursting" : ""} absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/95 backdrop-blur-sm shadow-sm transition-transform hover:scale-110 active:scale-90`}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`h-3.5 w-3.5 ${wishlisted ? "fill-destructive text-destructive" : "fill-transparent text-foreground stroke-[2]"}`} />
          </button>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
          <h3 className="text-[13px] font-semibold leading-snug line-clamp-1" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
            {product.name}
          </h3>
          {(product as any).short_description && (
            <p className="mt-0.5 text-[10px] line-clamp-1" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
              {(product as any).short_description}
            </p>
          )}
        </Link>

        <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
          {product.sale_price ? (
            <>
              <span className="text-[14px] font-extrabold whitespace-nowrap" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{currency}{Number(product.sale_price).toFixed(0)}</span>
              <span className="text-[10px] line-through" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 45%, transparent)" }}>{currency}{Number(product.price).toFixed(0)}</span>
            </>
          ) : (
            <span className="text-[14px] font-extrabold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{currency}{Number(product.price).toFixed(0)}</span>
          )}
        </div>
        {savings > 0 && (
          <p className="text-[10px] font-semibold text-success mt-0.5">You save {currency}{savings}</p>
        )}

        <div className="mt-2.5 flex items-center gap-1.5">
          {cartQty > 0 && !isAdding && !justAdded ? (
            <div className="flex h-8 flex-1 items-center rounded-md overflow-hidden" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}>
              <button onClick={handleDecrement} className="flex h-full w-8 items-center justify-center hover:opacity-80 active:scale-90" aria-label="Decrease"><Minus className="h-3 w-3" strokeWidth={2.5} /></button>
              <span className="flex-1 text-center text-[11px] font-semibold qty-bounce" aria-live="polite">{cartQty}</span>
              <button onClick={handleIncrement} className="flex h-full w-8 items-center justify-center hover:opacity-80 active:scale-90" aria-label="Increase"><Plus className="h-3 w-3" strokeWidth={2.5} /></button>
            </div>
          ) : (
            <button
              onClick={(e) => { createRipple(e); handleAdd(e); }}
              disabled={isAdding}
              className={`ripple-container flex h-8 flex-1 items-center justify-center gap-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all active:scale-[0.97] ${justAdded ? "bg-success text-success-foreground" : ""}`}
              style={justAdded ? undefined : {
                backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                borderRadius: "var(--storefront-button-radius, 0.375rem)",
              }}
            >
              {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : justAdded ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : (<><ShoppingCart className="h-3 w-3" />Add</>)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
