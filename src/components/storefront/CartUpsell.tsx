import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Plus, Star, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cleanImageUrl, optimizeImageUrl } from "@/lib/imageOptimize";
import { getDiscountPercent, getProductRating } from "@/lib/productUtils";

interface CartUpsellProps {
  storeId: string;
  currency: string;
}

export default function CartUpsell({ storeId, currency }: CartUpsellProps) {
  const { items, addToCart } = useCart();

  const cartProductIds = useMemo(() => new Set(items.map((i) => i.productId)), [items]);

  const { data: products } = useQuery({
    queryKey: ["cart-upsell", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, sale_price, image_url, category, slug, is_best_selling")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("is_best_selling", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Pick<Tables<"products">, "id" | "name" | "price" | "sale_price" | "image_url" | "category" | "slug" | "is_best_selling">[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId && items.length > 0,
  });

  // Filter out products already in cart, prioritize same category
  const upsellProducts = useMemo(() => {
    if (!products) return [];
    const cartCategories = new Set<string>();
    // We don't have category in cart items, so we match from products
    items.forEach((item) => {
      const p = products.find((pr) => pr.id === item.productId);
      if (p?.category) cartCategories.add(p.category);
    });

    const available = products.filter((p) => !cartProductIds.has(p.id));

    // Sort: same category first, then best sellers, then rest
    return available
      .sort((a, b) => {
        const aMatch = a.category && cartCategories.has(a.category) ? 1 : 0;
        const bMatch = b.category && cartCategories.has(b.category) ? 1 : 0;
        if (bMatch !== aMatch) return bMatch - aMatch;
        if (b.is_best_selling !== a.is_best_selling) return b.is_best_selling ? 1 : -1;
        return 0;
      })
      .slice(0, 8);
  }, [products, cartProductIds, items]);

  if (upsellProducts.length === 0) return null;

  const handleAdd = (product: typeof upsellProducts[0]) => {
    const price = product.sale_price && product.sale_price < product.price
      ? Number(product.sale_price)
      : Number(product.price);
    addToCart({
      productId: product.id,
      name: product.name,
      price,
      image: product.image_url || undefined,
    });
    toast.success(`${product.name} added!`);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 55%, transparent)" }}>
        You may also like
      </h3>
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {upsellProducts.map((product) => {
          const hasDiscount = product.sale_price && product.sale_price < product.price;
          const displayPrice = hasDiscount ? Number(product.sale_price) : Number(product.price);
          const rating = getProductRating(product.id);

          return (
            <div
              key={product.id}
              className="flex-shrink-0 w-[130px] rounded-xl overflow-hidden" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, inherit) 10%, transparent)", backgroundColor: "var(--storefront-bg, hsl(var(--card)))" }}
            >
              {/* Image */}
              <div className="relative aspect-square w-full" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, inherit) 5%, var(--storefront-bg, #fff))" }}>
                {product.image_url ? (
                  <img
                    src={optimizeImageUrl(cleanImageUrl(product.image_url), 200)}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    width={130}
                    height={130}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ShoppingCart className="h-6 w-6" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 20%, transparent)" }} />
                  </div>
                )}
                {hasDiscount && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-destructive px-1 py-0.5 text-[8px] font-bold text-destructive-foreground">
                    {getDiscountPercent(Number(product.price), Number(product.sale_price!))}% OFF
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-2 space-y-1">
                <p className="text-[10px] font-semibold line-clamp-2 leading-tight" style={{ color: "var(--storefront-text, inherit)" }}>
                  {product.name}
                </p>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5 rounded bg-success px-1 py-0.5">
                    <Star className="h-2 w-2 fill-success-foreground text-success-foreground" />
                    <span className="text-[8px] font-bold text-success-foreground">{rating}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold" style={{ color: "var(--storefront-text, inherit)" }}>
                    {currency} {displayPrice.toFixed(0)}
                  </span>
                  {hasDiscount && (
                    <span className="text-[9px] line-through" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 50%, transparent)" }}>
                      {currency} {Number(product.price).toFixed(0)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleAdd(product)}
                  className="flex h-6 w-full items-center justify-center gap-1 rounded-md text-[9px] font-bold uppercase tracking-wide transition-all active:scale-95" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
                >
                  <Plus className="h-3 w-3" strokeWidth={2.5} />
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}