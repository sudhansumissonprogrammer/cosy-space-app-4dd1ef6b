import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Minus, Plus, Loader2, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CategoryProductsDialogProps {
  open: boolean;
  onClose: () => void;
  categoryName: string;
  storeId: string;
}

export default function CategoryProductsDialog({
  open, onClose, categoryName, storeId,
}: CategoryProductsDialogProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [tab, setTab] = useState<string>("current");

  // Products IN this category
  const { data: categoryProducts = [], isLoading } = useQuery({
    queryKey: ["category-products", storeId, categoryName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock_quantity")
        .eq("store_id", storeId)
        .eq("category", categoryName)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && !!storeId && !!categoryName,
  });

  // Products NOT in this category (for adding)
  const { data: otherProducts = [], isLoading: loadingOther } = useQuery({
    queryKey: ["other-products", storeId, categoryName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock_quantity, category")
        .eq("store_id", storeId)
        .neq("category", categoryName)
        .order("name");
      if (error) throw error;
      // also include products with null category
      const { data: nullCat, error: err2 } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock_quantity, category")
        .eq("store_id", storeId)
        .is("category", null)
        .order("name");
      if (err2) throw err2;
      return [...(data || []), ...(nullCat || [])];
    },
    enabled: open && tab === "add" && !!storeId && !!categoryName,
  });

  const filteredCurrent = useMemo(() => {
    if (!search.trim()) return categoryProducts;
    const q = search.toLowerCase();
    return categoryProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [categoryProducts, search]);

  const filteredOther = useMemo(() => {
    if (!addSearch.trim()) return otherProducts;
    const q = addSearch.toLowerCase();
    return otherProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [otherProducts, addSearch]);

  const toggleCurrent = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllCurrent = () => {
    if (selected.size === filteredCurrent.length) setSelected(new Set());
    else setSelected(new Set(filteredCurrent.map((p) => p.id)));
  };

  const toggleAdd = (id: string) => {
    setAddSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllAdd = () => {
    if (addSelected.size === filteredOther.length) setAddSelected(new Set());
    else setAddSelected(new Set(filteredOther.map((p) => p.id)));
  };

  const removeMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (!ids.length) throw new Error("No products selected");
      for (const id of ids) {
        const { error } = await supabase
          .from("products")
          .update({ category: null })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${selected.size} product(s) removed from "${categoryName}"`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["category-products", storeId, categoryName] });
      queryClient.invalidateQueries({ queryKey: ["other-products", storeId, categoryName] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to remove products"),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(addSelected);
      if (!ids.length) throw new Error("No products selected");
      for (const id of ids) {
        const { error } = await supabase
          .from("products")
          .update({ category: categoryName })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${addSelected.size} product(s) added to "${categoryName}"`);
      setAddSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["category-products", storeId, categoryName] });
      queryClient.invalidateQueries({ queryKey: ["other-products", storeId, categoryName] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to add products"),
  });

  const handleClose = () => {
    setSelected(new Set());
    setAddSelected(new Set());
    setSearch("");
    setAddSearch("");
    setTab("current");
    onClose();
  };

  const ProductRow = ({
    product,
    checked,
    onToggle,
  }: {
    product: { id: string; name: string; price: number; image_url: string | null; category?: string | null };
    checked: boolean;
    onToggle: () => void;
  }) => (
    <label className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <div className="h-10 w-10 shrink-0 rounded-md bg-muted overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
        {product.category && (
          <p className="text-xs text-muted-foreground">Current: {product.category}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">₹{product.price}</span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Products in "{categoryName}"</DialogTitle>
          <DialogDescription>
            View, add or remove products from this category.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">
              Current ({categoryProducts.length})
            </TabsTrigger>
            <TabsTrigger value="add">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="flex-1 flex flex-col min-h-0 mt-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCurrent.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground text-sm">
                <Package className="h-8 w-8 mb-2" />
                No products in this category
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={selected.size === filteredCurrent.length && filteredCurrent.length > 0}
                      onCheckedChange={toggleAllCurrent}
                    />
                    Select All ({selected.size}/{filteredCurrent.length})
                  </label>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={selected.size === 0 || removeMutation.isPending}
                    onClick={() => removeMutation.mutate()}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Minus className="mr-1 h-3.5 w-3.5" />
                    )}
                    Remove {selected.size > 0 ? selected.size : ""}
                  </Button>
                </div>
                <div className="overflow-y-auto max-h-[40vh] rounded-md border divide-y">
                  {filteredCurrent.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      checked={selected.has(p.id)}
                      onToggle={() => toggleCurrent(p.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="add" className="flex-1 flex flex-col min-h-0 mt-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products to add..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingOther ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredOther.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground text-sm">
                <Package className="h-8 w-8 mb-2" />
                No more products to add
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={addSelected.size === filteredOther.length && filteredOther.length > 0}
                      onCheckedChange={toggleAllAdd}
                    />
                    Select All ({addSelected.size}/{filteredOther.length})
                  </label>
                  <Button
                    size="sm"
                    disabled={addSelected.size === 0 || addMutation.isPending}
                    onClick={() => addMutation.mutate()}
                  >
                    {addMutation.isPending ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-3.5 w-3.5" />
                    )}
                    Add {addSelected.size > 0 ? addSelected.size : ""}
                  </Button>
                </div>
                <div className="overflow-y-auto max-h-[40vh] rounded-md border divide-y">
                  {filteredOther.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      checked={addSelected.has(p.id)}
                      onToggle={() => toggleAdd(p.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
