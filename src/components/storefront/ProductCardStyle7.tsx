import { useCardImageReadiness } from "./CardImageReadiness";
/**
 * Style 7 — Floating Glass
 * Inspired by Apple, Nothing, Linear. Futuristic premium tech.
 * Soft gradient backdrop, frosted glass info chip, lift on hover.
 */
import { useState } from "react";
import { createRipple } from "@/lib/ripple";
import { Link } from "react-router-dom";
import { Package, Heart, Plus, Check, Loader2, Minus, Star } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getDiscountPercent, getProductRating, currencySymbol } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import ProductCardTitle from "./ProductCardTitle";
import WishlistHeartButton from "./WishlistHeartButton";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { setPdpPreload } from "@/lib/pdpPreload";
import { memo } from "react";
import { productCardPropsEqual } from "./cardMemo";

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
}

function ProductCardStyle7Impl({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const imageReady = useCardImageReadiness();
  const { wishlisted, cartQty, handleAddToCart, handleToggleWishlist, heartBursting, updateQuantity } = useProductCardActions(product);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const currency = currencySymbol(store.currency);

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
    try {
      const imgs = resolveProductImages(product);
      setPdpPreload({ slug: product.slug || product.id, image: imgs[0] || "", name: product.name, price: product.price as any, salePrice: (product.sale_price as any) ?? null, currency });
      prefetchProductDetail({ slug: product.slug || product.id, image: imgs[0] });
    } catch {}
  };

  return (
    <div
      className="group relative cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-1"
      style={{ contain: priority ? undefined : "layout style", contentVisibility: priority ? undefined : "auto" }}
      onMouseEnter={primePdp}
      onTouchStart={primePdp}
      onPointerDown={primePdp}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
        {/* Gradient backdrop stage */}
        <div
          className="relative w-full overflow-hidden rounded-2xl"
          style={{
            aspectRatio: "1 / 1",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 14%, transparent) 0%, color-mix(in srgb, var(--storefront-accent, hsl(var(--accent))) 8%, transparent) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 24px -8px rgba(0,0,0,0.12)",
          }}
        >
          {(() => {
            const images = resolveProductImages(product);
            if (images.length === 0) return <div className="flex h-full w-full items-center justify-center"><Package className="h-10 w-10 opacity-30" /></div>;
            return (
              <img
                src={optimizeImageUrl(images[0], 400, 75)}
                srcSet={getImageSrcSet(images[0], [300, 500, 700, 900], 75)}
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, 20vw"
                alt={product.name}
                width={400}
                height={400}
                data-no-crop="true"
                className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-300 ease-out hh:group-hover:scale-110 drop-shadow-xl"
                loading={priority || imageReady ? "eager" : "lazy"}
                decoding={priority ? "sync" : "async"}
                fetchPriority={priority ? "high" : "low"}
              />
            );
          })()}


          <WishlistHeartButton wishlisted={wishlisted} bursting={heartBursting} onClick={handleToggleWishlist} size={32} className="absolute right-2.5 top-2.5" />


          {/* Glass info chip */}
          <div
            className="absolute inset-x-2 bottom-2 rounded-xl px-3 py-2 backdrop-blur-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 65%, transparent)",
              border: "1px solid color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 50%, transparent)",
              boxShadow: "0 4px 16px -4px rgba(0,0,0,0.15)",
            }}
          >
            <ProductCardTitle name={product.name} className="font-semibold" baseSize={12} minSize={9.5} style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />

            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1 min-w-0">
                {product.sale_price ? (
                  <>
                    <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{currency}{Number(product.sale_price).toFixed(0)}</span>
                    <span className="text-[9px] line-through" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 45%, transparent)" }}>{currency}{Number(product.price).toFixed(0)}</span>
                  </>
                ) : (
                  <span className="text-[13px] font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{currency}{Number(product.price).toFixed(0)}</span>
                )}
              </div>
              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium opacity-70" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}><Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" /> {getProductRating(product.id)}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Add button below card */}
      <div className="mt-2 px-1">
        {cartQty > 0 && !isAdding && !justAdded ? (
          <div className="flex h-8 w-full items-center rounded-full overflow-hidden" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}>
            <button onClick={handleDecrement} className="flex h-full w-9 items-center justify-center hover:opacity-80 active:scale-[0.96]" aria-label="Decrease"><Minus className="h-3.5 w-3.5" strokeWidth={2.5} /></button>
            <span className="flex-1 text-center text-[11px] font-semibold qty-bounce" aria-live="polite">{cartQty}</span>
            <button onClick={handleIncrement} className="flex h-full w-9 items-center justify-center hover:opacity-80 active:scale-[0.96]" aria-label="Increase"><Plus className="h-3.5 w-3.5" strokeWidth={2.5} /></button>
          </div>
        ) : (
          <button
            onClick={(e) => { createRipple(e); handleAdd(e); }}
            disabled={isAdding}
            className={`ripple-container flex h-8 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold transition-[transform,opacity,colors,box-shadow] active:scale-[0.97] ${justAdded ? "bg-success text-success-foreground" : ""}`}
            style={justAdded ? undefined : {
              backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
              color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
            }}
          >
            {isAdding ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding</>) : justAdded ? (<><Check className="h-3.5 w-3.5" strokeWidth={3} />Added</>) : (<><Plus className="h-3.5 w-3.5" strokeWidth={2.5} />Add</>)}
          </button>
        )}
      </div>
    </div>
  );
}

const ProductCardStyle7 = memo(ProductCardStyle7Impl, productCardPropsEqual);
export default ProductCardStyle7;
