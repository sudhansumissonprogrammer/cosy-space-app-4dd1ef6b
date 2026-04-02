import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyStore } from "@/hooks/useMyStore";
import { ArrowUp, ArrowDown, GripVertical, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface BestSellerProduct {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  sale_price: number | null;
  currency: string;
  display_order: number;
  is_best_selling: boolean;
  stock_quantity: number;
}

export default function BestSellerManagement() {
  const { data: store } = useMyStore();
  const storeId = store?.id;
  const queryClient = useQueryClient();
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["best-sellers-manage", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, price, sale_price, currency, display_order, is_best_selling, stock_quantity")
        .eq("store_id", storeId!)
        .eq("is_best_selling", true)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BestSellerProduct[];
    },
    enabled: !!storeId,
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        supabase.from("products").update({ display_order: idx + 1 }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["best-sellers-manage", storeId] });
      toast.success("Order saved!");
    },
    onError: () => toast.error("Failed to save order"),
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("products")
        .update({ is_best_selling: false, display_order: 0 })
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["best-sellers-manage", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
      toast.success("Removed from best sellers");
    },
  });

  const moveItem = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (!products || toIdx < 0 || toIdx >= products.length) return;
      const arr = [...products];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      const ids = arr.map((p) => p.id);
      reorderMutation.mutate(ids);
    },
    [products, reorderMutation]
  );

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetIdx: number) => {
    if (dragIdx !== null && dragIdx !== targetIdx) {
      moveItem(dragIdx, targetIdx);
    }
    setDragIdx(null);
  };

  const currency = store?.currency || "INR";
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(v);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Star className="h-5 w-5 text-primary fill-primary" />
            Best Sellers
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drag to reorder or use arrows. This order is shown on your storefront.
          </p>
        </div>
        {products && (
          <span className="text-sm text-muted-foreground">{products.length} items</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !products || products.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-card">
          <div className="text-center">
            <Star className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              No best sellers yet. Mark products as best seller from the Products page.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product, idx) => (
            <div
              key={product.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              className={`flex items-center gap-3 rounded-xl border bg-card p-3 transition-all ${
                dragIdx === idx ? "opacity-50 scale-[0.98]" : "hover:shadow-sm"
              }`}
            >
              <div className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
                <GripVertical className="h-5 w-5" />
              </div>

              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                {idx + 1}
              </span>

              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                    No img
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {product.sale_price ? (
                    <>
                      <span className="line-through mr-1">{fmt(product.price)}</span>
                      <span className="text-foreground font-medium">{fmt(product.sale_price)}</span>
                    </>
                  ) : (
                    fmt(product.price)
                  )}
                  {" · "}Stock: {product.stock_quantity}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === 0 || reorderMutation.isPending}
                  onClick={() => moveItem(idx, idx - 1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === products.length - 1 || reorderMutation.isPending}
                  onClick={() => moveItem(idx, idx + 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeMutation.mutate(product.id)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
