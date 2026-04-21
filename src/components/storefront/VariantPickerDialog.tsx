import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, ShoppingCart, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    price: number;
    sale_price?: number | null;
    image_url?: string | null;
  };
}

export default function VariantPickerDialog({ open, onClose, product }: Props) {
  const { addToCart } = useCart();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: variants, isLoading } = useQuery({
    queryKey: ["product-variants", product.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("product_variants")
        .select("id, name, display_order")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("display_order");
      return (data || []) as { id: string; name: string }[];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const effectivePrice = product.sale_price && product.sale_price < product.price
    ? Number(product.sale_price)
    : Number(product.price);

  const selected = variants?.find((v) => v.id === selectedId);

  const handleAdd = () => {
    if (!selected) return;
    addToCart({
      productId: product.id,
      variantId: selected.id,
      name: product.name,
      variantName: selected.name,
      price: effectivePrice,
      image: product.image_url || undefined,
      quantity: 1,
    });
    onClose();
    setSelectedId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSelectedId(null); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Select Variant</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }} /></div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {variants?.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(selectedId === v.id ? null : v.id)}
                  className={`variant-chip-bounce relative rounded-xl border-2 px-4 py-2 text-sm font-semibold ${
                    selectedId === v.id
                      ? "is-selected border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  {selectedId === v.id && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                    </span>
                  )}
                  {v.name}
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!selectedId}
              onClick={handleAdd}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Cart
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
