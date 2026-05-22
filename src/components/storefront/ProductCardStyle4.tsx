import { useCallback, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import type { Tables } from "@/integrations/supabase/types";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";

/* ── Veg / Non-Veg indicator ── */
function DietBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const lower = category.toLowerCase();
  const isVeg = lower.includes("veg") && !lower.includes("non-veg");
  const isNonVeg = lower.includes("non-veg") || lower.includes("nonveg");
  if (!isVeg && !isNonVeg) return null;

  return (
    <div
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
      style={{ borderColor: isVeg ? "#22c55e" : "#ef4444" }}
    >
      <div
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: isVeg ? "#22c55e" : "#ef4444" }}
      />
    </div>
  );
}

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
  
}

export default function ProductCardStyle4({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const [hoverLoaded, setHoverLoaded] = useState(false);
  const { items, addToCart, updateQuantity } = useCart();
  const existing = items.find(
    (i) => i.productId === product.id && !i.variantId
  );
  const qty = existing?.quantity || 0;

  const price = product.sale_price || product.price;
  const originalPrice = product.sale_price ? product.price : null;
  const hasDiscount = originalPrice && originalPrice > price;
  const currency = store.currency === "USD" ? "$" : "₹";

  const handleAdd = useCallback(() => {
    if (onVariantRequired) { onVariantRequired(); return; }
    addToCart({
      productId: product.id,
      name: product.name,
      price,
      image: product.image_url || undefined,
      quantity: 1,
    });
  }, [addToCart, product, price, onVariantRequired]);

  const handleIncrease = useCallback(() => {
    updateQuantity(product.id, undefined, qty + 1);
  }, [updateQuantity, product.id, qty]);

  const handleDecrease = useCallback(() => {
    updateQuantity(product.id, undefined, qty - 1);
  }, [updateQuantity, product.id, qty]);

  return (
    <div
      className="flex gap-3 rounded-2xl p-3 transition-all"
      style={{
        backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 50%, transparent)",
        border: "1px solid hsl(var(--border, 0 0% 90%) / 0.3)",
      }}
    >
      {(() => {
        const images = resolveProductImages(product);
        if (images.length === 0) return null;
        const hasSecond = images.length > 1;
        return (
          <div onMouseEnter={() => setHoverLoaded(true)} className="group/img relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
            <img
              src={optimizeImageUrl(images[0], 400, 72)}
              srcSet={getImageSrcSet(images[0], [200, 300, 400], 72)}
              sizes="96px"
              alt={product.name}
              width={200}
              height={200}
              className={`h-full w-full object-cover transition-all duration-500 ${hasSecond && hoverLoaded ? "group-hover/img:opacity-0" : ""}`}
              loading={priority ? "eager" : "lazy"}
              decoding={priority ? "sync" : "async"}
              fetchPriority={priority ? "high" : "low"}

            />
            {hasSecond && hoverLoaded && (
              <img src={optimizeImageUrl(images[1], 400, 72)} alt={product.name} width={400} height={400} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 group-hover/img:opacity-100" loading="lazy" fetchPriority="low" />
            )}
            {hasDiscount && (
              <div className="absolute left-1 top-1 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                {Math.round(((originalPrice - price) / originalPrice) * 100)}% OFF
              </div>
            )}
          </div>
        );
      })()}

      {/* Details */}
      <div className="flex flex-1 flex-col justify-between gap-1 py-0.5">
        <div>
          <div className="flex items-center gap-1.5">
            <DietBadge category={product.category} />
            <h3
              className="text-sm font-semibold leading-tight line-clamp-2"
              style={{
                color: "var(--storefront-text, hsl(var(--foreground)))",
                fontFamily: "var(--storefront-heading-font, inherit)",
              }}
            >
              {product.name}
            </h3>
          </div>
          {product.description && (
            <p
              className="mt-0.5 text-xs leading-snug line-clamp-2 opacity-50"
              style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
            >
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-sm font-bold"
              style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
            >
              {currency}{price.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="price-strike-draw text-xs opacity-40" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                {currency}{originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* Quantity Controls */}
          {qty === 0 ? (
            <button
              onClick={handleAdd}
              className="rounded-xl px-4 py-1.5 text-xs font-bold transition-all active:scale-95"
              style={{
              backgroundColor: "color-mix(in srgb, var(--storefront-primary, #25D366) 8%, transparent)",
                color: "var(--storefront-primary, #25D366)",
                border: "1.5px solid color-mix(in srgb, var(--storefront-primary, #25D366) 25%, transparent)",
              }}
              aria-label={`Add ${product.name} to cart`}
            >
              ADD
            </button>
          ) : (
            <div
              className="flex items-center gap-0 rounded-xl overflow-hidden"
              style={{
                backgroundColor: "var(--storefront-primary, #25D366)",
                color: "var(--storefront-btn-text, #ffffff)",
              }}
            >
              <button
                onClick={handleDecrease}
                className="flex h-8 w-8 items-center justify-center transition-all active:scale-90"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="flex h-8 w-6 items-center justify-center text-xs font-bold" aria-live="polite">
                {qty}
              </span>
              <button
                onClick={handleIncrease}
                className="flex h-8 w-8 items-center justify-center transition-all active:scale-90"
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
