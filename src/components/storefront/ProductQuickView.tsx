import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Star, ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, Package } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import type { Tables } from "@/integrations/supabase/types";

interface ProductQuickViewProps {
  product: Tables<"products"> | null;
  store: Tables<"stores">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProductQuickView({ product, store, open, onOpenChange }: ProductQuickViewProps) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const hasDiscount = product.sale_price && product.sale_price < product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.sale_price!) / product.price) * 100)
    : 0;
  const price = hasDiscount ? product.sale_price! : product.price;
  const currency = product.currency || store.currency || "₹";

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: Number(price),
      image: product.image_url || undefined,
      quantity,
    });
    toast.success(`${product.name} added to cart`);
    onOpenChange(false);
    setQuantity(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden gap-0">
        <div className="grid sm:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-square bg-secondary/20">
            {product.image_url ? (
              <img
                src={optimizeImageUrl(product.image_url, 500)}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
            {hasDiscount && (
              <Badge className="absolute left-3 top-3 bg-success text-success-foreground border-0 text-xs font-bold">
                {discountPct}% OFF
              </Badge>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col p-5 gap-3">
            {product.category && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {product.category}
              </p>
            )}

            <h2 className="text-lg font-bold text-foreground leading-tight">{product.name}</h2>

            {/* Rating */}
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < 4 ? "fill-success text-success" : "text-muted-foreground/30"}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">4.5</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-foreground">
                {currency} {Number(price).toFixed(0)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
                  {currency} {Number(product.price).toFixed(0)}
                </span>
              )}
            </div>

            {product.description && (
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Stock */}
            {product.stock_quantity <= 0 ? (
              <Badge variant="destructive" className="w-fit text-xs">Out of Stock</Badge>
            ) : product.stock_quantity <= 10 ? (
              <p className="text-xs text-destructive font-semibold">Only {product.stock_quantity} left!</p>
            ) : null}

            {/* Quantity + Add to Cart */}
            <div className="mt-auto space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-2.5 py-1.5 hover:bg-accent transition-colors">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-3 py-1.5 text-sm font-bold min-w-[2rem] text-center">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="px-2.5 py-1.5 hover:bg-accent transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Button
                  onClick={handleAddToCart}
                  disabled={product.stock_quantity <= 0}
                  className="flex-1 gap-2 btn-gold h-10"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </Button>
              </div>

              <Link
                to={storefrontPath(store.slug, `product/${product.slug || product.id}`)}
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                View Full Details
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
