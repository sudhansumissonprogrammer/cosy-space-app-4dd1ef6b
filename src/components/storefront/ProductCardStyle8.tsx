/**
 * Style 8 — Quick Commerce Tile
 * Inspired by Blinkit, Zepto, Instamart. Fast, dense, conversion-focused.
 * Compact white card, delivery time pill, big price + MRP + % off, ADD→stepper.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, Plus, Minus, Zap, Heart, Check } from "lucide-react";
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

export default function ProductCardStyle8({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const { wishlisted, cartQty, handleAddToCart, handleToggleWishlist, heartBursting, updateQuantity } = useProductCardActions(product);
  const [justAdded, setJustAdded] = useState(false);
  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const currency = store.currency || "₹";
  const savings = product.sale_price ? Math.round(Number(product.price) - Number(product.sale_price)) : 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onVariantRequired) { onVariantRequired(); return; }
    handleAddToCart(e);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 900);
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
      className="relative flex flex-col rounded-xl p-2 transition-shadow cursor-pointer"
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
        border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 8%, transparent)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        contain: priority ? undefined : "layout style",
        contentVisibility: priority ? undefined : "auto",
      }}
      onMouseEnter={primePdp}
      onTouchStart={primePdp}
      onPointerDown={primePdp}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "1 / 1", backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 3%, transparent)" }}>
          {(() => {
            const images = resolveProductImages(product);
            if (images.length === 0) return <div className="flex h-full w-full items-center justify-center"><Package className="h-8 w-8 opacity-20" /></div>;
            return (
              <img
                src={optimizeImageUrl(images[0], 320, 72)}
                srcSet={getImageSrcSet(images[0], [240, 360, 480, 640], 72)}
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, 18vw"
                alt={product.name}
                width={320}
                height={320}
                data-no-crop="true"
                className="absolute inset-0 h-full w-full object-contain p-2"
                loading={priority ? "eager" : "lazy"}
                decoding={priority ? "sync" : "async"}
                fetchPriority={priority ? "high" : "low"}
              />
            );
          })()}

          {/* Delivery time pill */}
          <div className="absolute left-1.5 top-1.5">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-success/95 px-1.5 py-0.5 text-[8px] font-bold text-success-foreground shadow-sm">
              <Zap className="h-2.5 w-2.5 fill-current" strokeWidth={0} />10 MIN
            </span>
          </div>

          {discountPercent && (
            <div className="absolute -left-1 top-7">
              <span className="inline-block rounded-r-md bg-destructive px-1.5 py-0.5 text-[9px] font-extrabold text-destructive-foreground shadow-sm">
                {discountPercent}% OFF
              </span>
            </div>
          )}

          <button
            onClick={handleToggleWishlist}
            className={`heart-burst ${heartBursting ? "bursting" : ""} absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-transform hover:scale-110 active:scale-90`}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`h-3 w-3 ${wishlisted ? "fill-destructive text-destructive" : "fill-transparent text-foreground stroke-[2]"}`} />
          </button>
        </div>
      </Link>

      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block mt-2 flex-1">
        <h3 className="text-[12px] font-semibold leading-tight line-clamp-2 min-h-[2.1em]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
          {product.name}
        </h3>
        {(product as any).short_description && (
          <p className="mt-0.5 text-[10px] line-clamp-1" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
            {(product as any).short_description}
          </p>
        )}
      </Link>

      <div className="mt-2 flex items-end justify-between gap-1.5">
        <div className="flex flex-col min-w-0">
          {product.sale_price ? (
            <>
              <span className="text-[13px] font-extrabold leading-none whitespace-nowrap" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                {currency}{Number(product.sale_price).toFixed(0)}
              </span>
              <span className="text-[9px] line-through leading-tight" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
                {currency}{Number(product.price).toFixed(0)}
              </span>
              {savings > 0 && (
                <span className="text-[8px] font-semibold text-success leading-none mt-0.5">SAVE {currency}{savings}</span>
              )}
            </>
          ) : (
            <span className="text-[13px] font-extrabold whitespace-nowrap" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
              {currency}{Number(product.price).toFixed(0)}
            </span>
          )}
        </div>

        {cartQty > 0 ? (
          <div className="flex h-8 items-center rounded-md overflow-hidden shadow-sm" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}>
            <button onClick={handleDecrement} className="flex h-full w-7 items-center justify-center hover:opacity-80 active:scale-90" aria-label="Decrease"><Minus className="h-3 w-3" strokeWidth={3} /></button>
            <span className="px-1 text-[12px] font-bold qty-bounce min-w-[18px] text-center" aria-live="polite">{cartQty}</span>
            <button onClick={handleIncrement} className="flex h-full w-7 items-center justify-center hover:opacity-80 active:scale-90" aria-label="Increase"><Plus className="h-3 w-3" strokeWidth={3} /></button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            className={`flex h-8 min-w-[60px] items-center justify-center gap-1 rounded-md border-2 px-3 text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${justAdded ? "bg-success text-success-foreground border-success" : "bg-transparent hover:shadow-md"}`}
            style={justAdded ? undefined : {
              borderColor: "var(--storefront-primary, hsl(var(--primary)))",
              color: "var(--storefront-primary, hsl(var(--primary)))",
              backgroundColor: "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 5%, transparent)",
            }}
          >
            {justAdded ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : "ADD"}
          </button>
        )}
      </div>
    </div>
  );
}
