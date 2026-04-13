import { useState } from "react";
import { createRipple } from "@/lib/ripple";
import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Zap, Heart, Check, Plus, Minus, Loader2, Flame, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, splitImageUrls } from "@/lib/imageOptimize";
import { getProductRating, getDiscountPercent } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";

type BadgeType = "trending" | "new" | "bestseller";

const badgeConfigs: { type: BadgeType; label: string; Icon: typeof Zap; style: React.CSSProperties }[] = [
  { type: "trending", label: "Trending", Icon: Zap, style: { backgroundColor: "var(--storefront-text, hsl(var(--foreground)))", color: "var(--storefront-bg, hsl(var(--background)))" } },
  { type: "new", label: "New Arrival", Icon: Sparkles, style: { backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 30%, transparent)", backdropFilter: "blur(12px)", border: "1px solid color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 40%, transparent)", color: "var(--storefront-text, hsl(var(--foreground)))" } },
  { type: "bestseller", label: "Best Seller", Icon: Flame, style: { backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 30%, transparent)", backdropFilter: "blur(12px)", border: "1px solid color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 40%, transparent)", color: "var(--storefront-text, hsl(var(--foreground)))" } },
];

function getProductBadge(productId: string, isBestSelling: boolean): typeof badgeConfigs[number] | null {
  if (isBestSelling) return badgeConfigs[2];
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  if (Math.abs(hash) % 10 < 3) return null;
  return badgeConfigs[Math.abs(hash) % 3];
}

interface StorefrontProductCardProps {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
}

const cardShadow = "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)";
const cardHoverShadow = "0 2px 8px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.10)";

export default function StorefrontProductCard({ product, slug, store, priority = false }: StorefrontProductCardProps) {
  const { wishlisted, cartQty, handleAddToCart: hookAddToCart, handleToggleWishlist, updateQuantity } = useProductCardActions(product);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    if (isAdding) return;
    setIsAdding(true);
    hookAddToCart(e);
    setIsAdding(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const handleIncrement = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty + 1); };
  const handleDecrement = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty - 1); };

  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const categoryLabel = product.category || "TOP RATED";

  return (
    <div
      className="group rounded-xl overflow-hidden transition-all duration-300 ease-out cursor-pointer"
      style={{ boxShadow: cardShadow, backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = cardHoverShadow; e.currentTarget.style.transform = "translateY(-4px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = cardShadow; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block p-1 pb-0">
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "4/5" }}>
          {(() => {
            const badge = getProductBadge(product.id, product.is_best_selling);
            if (!badge) return null;
            const BadgeIcon = badge.Icon;
            return (
              <div className="absolute left-2 top-2 z-10">
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={badge.style}>
                  <BadgeIcon className="h-3 w-3" />
                  {badge.label}
                </span>
              </div>
            );
          })()}

          <button onClick={handleToggleWishlist} className="absolute right-2.5 top-2.5 z-10 p-1 transition-all duration-200 hover:scale-110 active:scale-95" aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}>
            <Heart className={`h-4 w-4 drop-shadow-md transition-colors duration-200 ${wishlisted ? "fill-destructive text-destructive" : ""}`} style={wishlisted ? undefined : { fill: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 60%, transparent)", color: "var(--storefront-bg, hsl(var(--card)))", strokeWidth: 2.5 }} aria-hidden="true" />
          </button>

          {(() => {
            const images = splitImageUrls(product.image_url);
            if (images.length === 0) {
              return <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 5%, var(--storefront-bg, hsl(var(--background))))" }}><Package className="h-10 w-10" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 30%, transparent)" }} /></div>;
            }
            const hasSecond = images.length > 1;
            return (
              <>
                <img src={optimizeImageUrl(images[0], 400)} srcSet={getImageSrcSet(images[0], [300, 400, 600])} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" alt={product.name} width={400} height={500} className={`h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-105 ${hasSecond ? "group-hover:opacity-0" : ""}`} loading={priority ? "eager" : "lazy"} decoding={priority ? "sync" : "async"} fetchPriority={priority ? "high" : "auto"} />
                {hasSecond && (
                  <img src={optimizeImageUrl(images[1], 400)} alt={product.name} width={400} height={500} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-105" loading="lazy" />
                )}
              </>
            );
          })()}
        </div>
      </Link>

      <div className="px-3 pt-2.5 pb-3 sm:px-3.5 sm:pb-3.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>{categoryLabel}</p>
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-success text-success" />
            <span className="text-[10px] font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{getProductRating(product.id)}</span>
          </div>
        </div>

        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)}>
          <h3 className="text-xs font-bold leading-tight line-clamp-2 transition-colors duration-200" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{product.name}</h3>
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          {product.sale_price ? (
            <>
              <span className="text-sm font-extrabold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{store.currency || "₹"}{Number(product.sale_price).toFixed(0)}</span>
              <span className="text-[10px] line-through" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 45%, transparent)" }}>{store.currency || "₹"}{Number(product.price).toFixed(0)}</span>
              {discountPercent && <span className="rounded-full bg-success px-1.5 py-0.5 text-[9px] font-bold text-success-foreground">{discountPercent}% off</span>}
            </>
          ) : (
            <span className="text-sm font-extrabold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{store.currency || "₹"}{Number(product.price).toFixed(0)}</span>
          )}
        </div>

        {cartQty > 0 && !isAdding && !justAdded ? (
          <div className="flex h-7 sm:h-8 w-full items-center rounded-lg overflow-hidden" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}>
            <button onClick={handleDecrement} className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-90" aria-label="Decrease quantity"><Minus className="h-3 w-3" strokeWidth={2.5} /></button>
            <span key={cartQty} className="flex-1 text-center text-[9px] font-extrabold whitespace-nowrap qty-bounce" aria-live="polite">{cartQty} in cart</span>
            <button onClick={handleIncrement} className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-90" aria-label="Increase quantity"><Plus className="h-3 w-3" strokeWidth={2.5} /></button>
          </div>
        ) : (
          <button
            className={`ripple-container flex h-7 w-full items-center justify-center gap-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest sm:h-8 sm:text-[10px] transition-all duration-300 active:scale-[0.95] ${justAdded ? "bg-success text-success-foreground" : ""}`}
            style={justAdded ? undefined : isAdding ? { backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))", opacity: 0.8, cursor: "wait" } : { backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
            onClick={(e) => { createRipple(e); handleAddToCart(e); }}
            disabled={isAdding}
          >
            {isAdding ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="whitespace-nowrap">Adding...</span></>) : justAdded ? (<><Check className="h-3.5 w-3.5" strokeWidth={3} /><span className="whitespace-nowrap">Added ✓</span></>) : (<><ShoppingCart className="h-3.5 w-3.5" /><span className="whitespace-nowrap">ADD TO CART</span></>)}
          </button>
        )}
      </div>
    </div>
  );
}
