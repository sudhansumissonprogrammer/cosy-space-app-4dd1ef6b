import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Heart, Check, Plus, Minus, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, splitImageUrls } from "@/lib/imageOptimize";
import { getProductRating, getDiscountPercent } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";

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
  const { wishlisted, cartQty, effectivePrice, handleAddToCart, handleToggleWishlist, updateQuantity } = useProductCardActions(product);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const categoryLabel = product.category || "TOP RATED";

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
      className="group rounded-xl bg-card overflow-hidden border border-border/50 transition-all duration-300 ease-out cursor-pointer"
      style={{ boxShadow: cardShadow, contain: priority ? undefined : "layout style", contentVisibility: priority ? undefined : "auto" }}
      onMouseEnter={(e) => { prefetchProductDetail(); e.currentTarget.style.boxShadow = cardHoverShadow; e.currentTarget.style.transform = "translateY(-4px)"; }}
      onTouchStart={prefetchProductDetail}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = cardShadow; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block p-1 pb-0">
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "4/5" }}>
          {discountPercent && (
            <div className="absolute left-2 top-2 z-10">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[8px] font-bold text-destructive-foreground">
                -{discountPercent}%
              </span>
            </div>
          )}
          <button onClick={handleToggleWishlist} className="absolute right-2.5 top-2.5 z-10 p-1 transition-all duration-200 hover:scale-110 active:scale-95" aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}>
            <Heart className={`h-4 w-4 drop-shadow-md transition-colors duration-200 ${wishlisted ? "fill-destructive text-destructive" : "fill-card/60 text-card stroke-[2.5]"}`} aria-hidden="true" />
          </button>
          {(() => {
            const images = splitImageUrls(product.image_url);
            if (images.length === 0) {
              return <div className="flex h-full w-full items-center justify-center bg-secondary/40"><Package className="h-10 w-10 text-muted-foreground/40" /></div>;
            }
            const hasSecond = images.length > 1;
            return (
              <>
                <img src={optimizeImageUrl(images[0], 400, 80)} srcSet={getImageSrcSet(images[0], [400, 800], 80)} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" alt={product.name} width={400} height={500} className={`h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-105 ${hasSecond ? "group-hover:opacity-0" : ""}`} loading={priority ? "eager" : "lazy"} decoding={priority ? "sync" : "async"} fetchPriority={priority ? "high" : "auto"} />
                {hasSecond && (
                  <img src={optimizeImageUrl(images[1], 400, 80)} srcSet={getImageSrcSet(images[1], [400, 800], 80)} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" alt={product.name} width={400} height={500} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-105" loading="lazy" decoding="async" />
                )}
              </>
            );
          })()}
        </div>
      </Link>
      <div className="px-3 pt-2.5 pb-3 sm:px-3.5 sm:pb-3.5 space-y-1.5">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span className="text-[10px] font-bold text-foreground">{getProductRating(product.id)}</span>
          </div>
        </div>
        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)}>
          <h3 className="text-xs font-bold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200">{product.name}</h3>
        </Link>
        <div className="flex items-center gap-1 min-w-0">
          {product.sale_price ? (
            <>
              <span className="text-sm font-extrabold text-foreground whitespace-nowrap">{store.currency || "₹"}{Number(product.sale_price).toFixed(0)}</span>
              <span className="text-[10px] text-muted-foreground line-through whitespace-nowrap">{store.currency || "₹"}{Number(product.price).toFixed(0)}</span>
              {discountPercent && <span className="rounded-full bg-success px-1 py-0.5 text-[8px] font-bold text-success-foreground whitespace-nowrap shrink-0">{discountPercent}% off</span>}
            </>
          ) : (
            <span className="text-sm font-extrabold text-foreground">{store.currency || "₹"}{Number(product.price).toFixed(0)}</span>
          )}
        </div>
        {cartQty > 0 && !isAdding && !justAdded ? (
          <div className="flex h-7 sm:h-8 w-full items-center rounded-lg overflow-hidden btn-gold">
            <button onClick={handleDecrement} className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-95" aria-label="Decrease quantity"><Minus className="h-3 w-3" strokeWidth={2.5} /></button>
            <span className="flex-1 text-center text-[9px] font-extrabold whitespace-nowrap" aria-live="polite">{cartQty} in cart</span>
            <button onClick={handleIncrement} className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-95" aria-label="Increase quantity"><Plus className="h-3 w-3" strokeWidth={2.5} /></button>
          </div>
        ) : (
          <button className={`flex h-7 w-full items-center justify-center gap-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest sm:h-8 sm:text-[10px] transition-all duration-300 active:scale-[0.98] ${justAdded ? "bg-success text-success-foreground" : isAdding ? "btn-gold opacity-80 cursor-wait" : "btn-gold hover:brightness-110"}`} onClick={handleAdd} disabled={isAdding}>
            {isAdding ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="whitespace-nowrap">Adding...</span></>) : justAdded ? (<><Check className="h-3.5 w-3.5" strokeWidth={3} /><span className="whitespace-nowrap">Added to Cart</span></>) : (<><ShoppingCart className="h-3.5 w-3.5" /><span className="whitespace-nowrap">ADD TO CART</span></>)}
          </button>
        )}
      </div>
    </div>
  );
}
