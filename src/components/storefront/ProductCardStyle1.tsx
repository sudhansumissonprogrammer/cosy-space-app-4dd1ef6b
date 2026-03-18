import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingCart, Star, Heart, Check, Plus, Minus, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet } from "@/lib/imageOptimize";


function getProductRating(productId: string): number {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i);
    hash |= 0;
  }
  const ratings = [4.2, 4.3, 4.3, 4.4, 4.5, 4.5, 4.5, 4.6, 4.6, 4.6, 4.6, 4.7, 4.8, 4.9];
  return ratings[Math.abs(hash) % ratings.length];
}

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
}

const cardShadow = "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)";
const cardHoverShadow = "0 2px 8px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.10)";

export default function ProductCardStyle1({ product, slug, store, priority = false }: Props) {
  const { addToCart, items, updateQuantity } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  

  const wishlisted = isWishlisted(product.id);
  const cartItem = items.find((i) => i.productId === product.id && !i.variantId);
  const cartQty = cartItem?.quantity || 0;

  const price = product.sale_price && product.sale_price < product.price
    ? Number(product.sale_price)
    : Number(product.price);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdding) return;
    setIsAdding(true);
    addToCart({ productId: product.id, name: product.name, price, image: product.image_url || undefined });
    setIsAdding(false);
    setJustAdded(true);
    toast.success(`${product.name} added to cart`);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const handleIncrement = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty + 1); };
  const handleDecrement = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty - 1); };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({ productId: product.id, name: product.name, price: Number(product.price), salePrice: product.sale_price ? Number(product.sale_price) : undefined, image: product.image_url || undefined, slug: product.slug || product.id, category: product.category || undefined });
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
  };

  const discountPercent = product.sale_price && product.sale_price < product.price
    ? Math.round(((Number(product.price) - Number(product.sale_price)) / Number(product.price)) * 100)
    : null;

  const categoryLabel = product.category || "TOP RATED";

  return (
    <div
      className="group rounded-xl bg-card overflow-hidden border border-border/50 transition-all duration-300 ease-out cursor-pointer"
      style={{ boxShadow: cardShadow }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = cardHoverShadow; e.currentTarget.style.transform = "translateY(-4px)"; }}
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
          <button onClick={handleWishlist} className="absolute right-2.5 top-2.5 z-10 p-1 transition-all duration-200 hover:scale-110 active:scale-95">
            <Heart className={`h-4 w-4 drop-shadow-md transition-colors duration-200 ${wishlisted ? "fill-destructive text-destructive" : "fill-card/60 text-card stroke-[2.5]"}`} />
          </button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewOpen(true); }} className="absolute right-2.5 bottom-2.5 z-10 flex items-center gap-1 rounded-full bg-card/80 backdrop-blur-sm px-2 py-1 text-[9px] font-bold text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-card shadow-sm">
            <Eye className="h-3 w-3" /> Quick View
          </button>
          {product.image_url ? (
            <img src={optimizeImageUrl(product.image_url, 400)} srcSet={getImageSrcSet(product.image_url, [300, 400, 600])} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" alt={product.name} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" loading={priority ? "eager" : "lazy"} decoding={priority ? "sync" : "async"} fetchPriority={priority ? "high" : "auto"} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary/40"><Package className="h-10 w-10 text-muted-foreground/40" /></div>
          )}
        </div>
      </Link>
      <div className="px-3 pt-2.5 pb-3 sm:px-3.5 sm:pb-3.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{categoryLabel}</p>
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-bold text-foreground">{getProductRating(product.id)}</span>
          </div>
        </div>
        <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)}>
          <h3 className="text-xs font-bold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200">{product.name}</h3>
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          {product.sale_price ? (
            <>
              <span className="text-sm font-extrabold text-foreground">{store.currency || "₹"}{Number(product.sale_price).toFixed(0)}</span>
              <span className="text-[10px] text-muted-foreground line-through">{store.currency || "₹"}{Number(product.price).toFixed(0)}</span>
              {discountPercent && <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-bold text-success">{discountPercent}% off</span>}
            </>
          ) : (
            <span className="text-sm font-extrabold text-foreground">{store.currency || "₹"}{Number(product.price).toFixed(0)}</span>
          )}
        </div>
        {cartQty > 0 && !isAdding && !justAdded ? (
          <div className="flex h-7 sm:h-8 w-full items-center rounded-lg overflow-hidden btn-gold">
            <button onClick={handleDecrement} className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-95"><Minus className="h-3 w-3" strokeWidth={2.5} /></button>
            <span className="flex-1 text-center text-[9px] font-extrabold whitespace-nowrap">{cartQty} in cart</span>
            <button onClick={handleIncrement} className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-95"><Plus className="h-3 w-3" strokeWidth={2.5} /></button>
          </div>
        ) : (
          <button className={`flex h-7 w-full items-center justify-center gap-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest sm:h-8 sm:text-[10px] transition-all duration-300 active:scale-[0.98] ${justAdded ? "bg-success text-success-foreground" : isAdding ? "btn-gold opacity-80 cursor-wait" : "btn-gold hover:brightness-110"}`} onClick={handleAddToCart} disabled={isAdding}>
            {isAdding ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="whitespace-nowrap">Adding...</span></>) : justAdded ? (<><Check className="h-3.5 w-3.5" strokeWidth={3} /><span className="whitespace-nowrap">Added to Cart</span></>) : (<><ShoppingCart className="h-3.5 w-3.5" /><span className="whitespace-nowrap">ADD TO CART</span></>)}
          </button>
        )}
      </div>
      <ProductQuickView product={product} store={store} open={quickViewOpen} onOpenChange={setQuickViewOpen} />
    </div>
  );
}
