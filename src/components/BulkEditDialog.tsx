import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent,
  AlertDialogDescription as AlertDesc, AlertDialogFooter as AlertFoot,
  AlertDialogHeader as AlertHead, AlertDialogTitle as AlertTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  image_url: string | null;
}

interface BulkEditDialogProps {
  products: Product[];
  storeId: string;
}

export default function BulkEditDialog({ products, storeId }: BulkEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [priceChange, setPriceChange] = useState("");
  const [stockChange, setStockChange] = useState("");
  const [priceMode, setPriceMode] = useState<"set" | "adjust">("set");
  const [stockMode, setStockMode] = useState<"set" | "adjust">("set");
  const queryClient = useQueryClient();

  const toggleProduct = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error("No products selected");

      for (const id of ids) {
        const product = products.find((p) => p.id === id);
        if (!product) continue;

        const updates: Record<string, number> = {};

        if (priceChange !== "") {
          const val = parseFloat(priceChange);
          if (isNaN(val)) throw new Error("Invalid price value");
          updates.price = priceMode === "set" ? val : Math.max(0, product.price + val);
        }

        if (stockChange !== "") {
          const val = parseInt(stockChange);
          if (isNaN(val)) throw new Error("Invalid stock value");
          updates.stock_quantity = stockMode === "set" ? val : Math.max(0, product.stock_quantity + val);
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from("products").update(updates).eq("id", id).eq("store_id", storeId);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
      toast.success(`${selected.size} products updated`);
      setOpen(false);
      setSelected(new Set());
      setPriceChange("");
      setStockChange("");
    },
    onError: (err: any) => toast.error(err.message || "Bulk update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error("No products selected");
      // FK ON DELETE CASCADE handles product_images & product_variants atomically
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      queryClient.invalidateQueries({ queryKey: ["product-limit"] });
      toast.success(`${selected.size} products deleted`);
      setOpen(false);
      setSelected(new Set());
    },
    onError: (err: any) => toast.error(err.message || "Bulk delete failed"),
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={products.length === 0}>
        <Pencil className="mr-2 h-4 w-4" />Bulk Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Edit Products</DialogTitle>
            <DialogDescription>Select products and set new price/stock values or delete them.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Select products */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selected.size === products.length && products.length > 0}
                  onCheckedChange={toggleAll}
                />
                <Label className="text-sm font-medium">Select All ({selected.size}/{products.length})</Label>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent cursor-pointer text-sm">
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleProduct(p.id)} />
                    <span className="truncate text-foreground">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">${p.price} / {p.stock_quantity} qty</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label>Price</Label>
              <div className="flex gap-2">
                <select
                  value={priceMode}
                  onChange={(e) => setPriceMode(e.target.value as "set" | "adjust")}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="set">Set to</option>
                  <option value="adjust">Adjust by (+/-)</option>
                </select>
                <Input
                  type="number"
                  placeholder={priceMode === "set" ? "New price" : "+10 or -5"}
                  value={priceChange}
                  onChange={(e) => setPriceChange(e.target.value)}
                />
              </div>
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label>Stock Quantity</Label>
              <div className="flex gap-2">
                <select
                  value={stockMode}
                  onChange={(e) => setStockMode(e.target.value as "set" | "adjust")}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="set">Set to</option>
                  <option value="adjust">Adjust by (+/-)</option>
                </select>
                <Input
                  type="number"
                  placeholder={stockMode === "set" ? "New stock" : "+10 or -5"}
                  value={stockChange}
                  onChange={(e) => setStockChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={selected.size === 0 || deleteMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {deleteMutation.isPending ? "Deleting..." : `Delete ${selected.size}`}
                </Button>
              </AlertDialogTrigger>
              <AlertContent>
                <AlertHead>
                  <AlertTitle>Delete {selected.size} Products</AlertTitle>
                  <AlertDesc>
                    This will permanently delete the selected products and all their images/variants. This cannot be undone.
                  </AlertDesc>
                </AlertHead>
                <AlertFoot>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMutation.mutate()}
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertFoot>
              </AlertContent>
            </AlertDialog>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
              <Button
                onClick={() => bulkMutation.mutate()}
                disabled={selected.size === 0 || (priceChange === "" && stockChange === "") || bulkMutation.isPending}
                className="flex-1 sm:flex-none"
              >
                {bulkMutation.isPending ? "Updating..." : `Update ${selected.size}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
