import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Tag, ToggleLeft, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    price: number | string;
    sale_price: number | string | null;
    stock_quantity: number;
    is_active: boolean;
    image_url?: string | null;
    currency?: string | null;
  } | null;
  storeId?: string;
}

/**
 * Mobile quick-edit bottom sheet.
 * Lets the merchant change price, sale price, stock and active status without
 * opening the full Edit Product page. Designed for the most common 95% of
 * dashboard edits done on phone (price update, stock change, archive).
 */
export default function QuickEditProductModal({ open, onOpenChange, product, storeId }: Props) {
  const qc = useQueryClient();
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("");
  const [active, setActive] = useState(true);

  // Reset whenever a different product is opened
  useEffect(() => {
    if (!product) return;
    setPrice(String(product.price ?? ""));
    setSalePrice(product.sale_price != null ? String(product.sale_price) : "");
    setStock(String(product.stock_quantity ?? 0));
    setActive(!!product.is_active);
  }, [product]);

  const save = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("No product");
      const updates: Record<string, any> = {
        price: Number(price) || 0,
        sale_price: salePrice.trim() === "" ? null : Number(salePrice),
        stock_quantity: Number(stock) || 0,
        is_active: active,
      };
      const { error } = await (supabase as any)
        .from("products")
        .update(updates)
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["dashboard-products"] });
      qc.invalidateQueries({ queryKey: ["products", storeId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const currencySymbol = product?.currency === "INR" ? "₹"
    : product?.currency === "USD" ? "$"
    : (product?.currency ?? "");

  // Quick stock presets — most common Indian seller actions
  const stockPresets = [0, 5, 10, 25, 50];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-0 pt-0 pb-0 max-h-[88vh] flex flex-col"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center gap-3">
            {product?.image_url ? (
              <img
                src={product.image_url}
                alt=""
                className="h-11 w-11 rounded-lg border object-cover shrink-0"
              />
            ) : (
              <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 text-left">
              <SheetTitle className="text-sm font-bold truncate">{product?.name}</SheetTitle>
              <p className="text-[11px] text-muted-foreground">Quick edit</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* ── Price row ── */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Pricing
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="qe-price" className="text-[11px] text-muted-foreground">Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="qe-price"
                    type="number"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pl-7 h-11 text-base font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="qe-sale" className="text-[11px] text-muted-foreground">Sale price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="qe-sale"
                    type="number"
                    inputMode="decimal"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="—"
                    className="pl-7 h-11 text-base font-semibold"
                  />
                </div>
              </div>
            </div>
            {salePrice && Number(salePrice) > 0 && Number(price) > 0 && Number(salePrice) < Number(price) && (
              <p className="text-[11px] text-emerald-600 font-medium">
                {Math.round(((Number(price) - Number(salePrice)) / Number(price)) * 100)}% off
              </p>
            )}
          </section>

          {/* ── Stock row ── */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3 w-3" /> Stock
            </Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setStock(String(Math.max(0, Number(stock) - 1)))}
              >−</Button>
              <Input
                type="number"
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="h-11 text-base font-semibold text-center"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setStock(String(Number(stock) + 1))}
              >+</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {stockPresets.map((n) => (
                <button
                  key={n}
                  onClick={() => setStock(String(n))}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                    Number(stock) === n
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {n === 0 ? "Out of stock" : n}
                </button>
              ))}
              <button
                onClick={() => setStock("999999")}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                  Number(stock) >= 999999
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                ∞ Unlimited
              </button>
            </div>
          </section>

          {/* ── Active status ── */}
          <section className="flex items-center justify-between rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2.5">
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Visible in store</p>
                <p className="text-[11px] text-muted-foreground">Hide from storefront without deleting</p>
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </section>
        </div>

        {/* ── Sticky save bar ── */}
        <div
          className="border-t px-4 py-3 bg-background flex gap-2"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 font-semibold"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
