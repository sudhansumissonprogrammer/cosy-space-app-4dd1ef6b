import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { fireMetaCAPI } from "@/lib/metaCapi";
import { cleanImageUrl, optimizeImageUrl } from "@/lib/imageOptimize";
import { getDiscountPercent } from "@/lib/productUtils";

interface UpsellProps {
  storeId: string;
  storeName: string;
  orderId: string;
  orderNumber: string | null;
  orderedProductIds: string[];
  currency: string;
  onSkip: () => void;
}

export default function PostPurchaseUpsell({ storeId, storeName, orderId, orderNumber, orderedProductIds, currency, onSkip }: UpsellProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { data: upsellProducts } = useQuery({
    queryKey: ["post-purchase-upsell", storeId, orderedProductIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .not("id", "in", `(${orderedProductIds.join(",")})`)
        .order("is_best_selling", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
    enabled: orderedProductIds.length > 0,
  });

  const handleAddToOrder = async (product: any) => {
    setAdding(product.id);
    try {
      const price = product.sale_price && product.sale_price < product.price ? product.sale_price : product.price;
      
      // Insert the item directly into order_items and update order total
      const { error: itemErr } = await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: price,
        total: price,
      });
      if (itemErr) throw itemErr;

      // Update order total
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("total")
        .eq("id", orderId)
        .single();
      
      if (currentOrder) {
        await supabase
          .from("orders")
          .update({ total: Number(currentOrder.total) + Number(price) })
          .eq("id", orderId);
      }

      setAddedIds((prev) => new Set(prev).add(product.id));
      toast.success(`${product.name} added to your order!`);

      // Fire CAPI event
      fireMetaCAPI({
        storeId,
        eventName: "Purchase",
        customData: {
          content_ids: [product.id],
          content_type: "product",
          value: Number(price),
          currency,
          order_id: orderId,
        },
      });
    } catch (err) {
      toast.error("Failed to add item");
    } finally {
      setAdding(null);
    }
  };

  if (!upsellProducts || upsellProducts.length === 0) {
    onSkip();
    return null;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <ShoppingBag className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Wait! Special offer just for you 🎁</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add these to order {orderNumber || `#${orderId.slice(0, 8)}`} with one tap
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {upsellProducts.map((product) => {
          const price = product.sale_price && product.sale_price < product.price ? product.sale_price : product.price;
          const hasDiscount = product.sale_price && product.sale_price < product.price;
          const isAdded = addedIds.has(product.id);

          return (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30"
            >
              <img
                src={optimizeImageUrl(cleanImageUrl(product.image_url) || "/placeholder.svg", 200)}
                alt={product.name}
                className="h-16 w-16 rounded-lg object-cover border border-border flex-shrink-0"
                loading="lazy"
                width={64}
                height={64}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground line-clamp-1">{product.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-foreground">{currency} {Number(price).toFixed(0)}</span>
                  {hasDiscount && (
                    <>
                      <span className="text-xs text-muted-foreground line-through">{currency} {Number(product.price).toFixed(0)}</span>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        {getDiscountPercent(product.price, product.sale_price!)}% OFF
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={isAdded ? "secondary" : "default"}
                disabled={!!adding || isAdded}
                onClick={() => handleAddToOrder(product)}
                className="shrink-0 text-xs font-bold"
              >
                {adding === product.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isAdded ? (
                  "Added ✓"
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="w-full text-sm text-muted-foreground hover:text-foreground"
        onClick={onSkip}
      >
        No thanks, show my confirmation →
      </Button>
    </div>
  );
}
