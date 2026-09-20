import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Loader2, Search, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Product { id: string; name: string; image_url: string | null; }
interface Props {
  open: boolean;
  categoryId: string;
  categoryName: string;
  storeId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function CategoryFeaturedProductsDialog({ open, categoryId, categoryName, storeId, onClose, onSaved }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["category-featured-products", categoryId],
    enabled: open,
    queryFn: async () => {
      const [productsResult, selectedResult] = await Promise.all([
        supabase.from("products").select("id,name,image_url").eq("store_id", storeId).eq("category", categoryName).eq("is_active", true).eq("hidden_by_category", false).not("image_url", "is", null).order("display_order").order("created_at", { ascending: false }),
        supabase.from("category_featured_products").select("product_id,position").eq("category_id", categoryId).order("position"),
      ]);
      if (productsResult.error) throw productsResult.error;
      if (selectedResult.error) throw selectedResult.error;
      return { products: (productsResult.data || []) as Product[], selected: (selectedResult.data || []).map((row) => row.product_id) };
    },
  });

  useEffect(() => {
    if (data) setSelected(data.selected);
  }, [data]);

  const products = data?.products || [];
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const filtered = products.filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase()));

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 4 ? [...current, id] : current);
    if (!selected.includes(id) && selected.length >= 4) toast.error("You can choose up to four products");
  };

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selected.length) return;
    setSelected((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("set_category_featured_products", { _category_id: categoryId, _product_ids: selected });
      if (error) throw error;
      toast.success(selected.length ? "Category display photos updated" : "Automatic category photos restored");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Could not save display photos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 pb-4 pt-5">
          <DialogTitle>Category display photos</DialogTitle>
          <DialogDescription>Choose and order up to four products for {categoryName}. Leave empty for automatic selection.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-4 gap-2" aria-label="Selected category products">
            {Array.from({ length: 4 }).map((_, index) => {
              const product = byId.get(selected[index]);
              return (
                <div key={index} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                  {product?.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full items-center justify-center text-xs text-muted-foreground">{index + 1}</span>}
                  {product && (
                    <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1">
                      <Button type="button" size="icon" variant="secondary" className="h-7 w-7" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move earlier"><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="secondary" className="h-7 w-7" disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label="Move later"><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={() => toggle(product.id)} aria-label="Remove"><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="pl-9" />
          </div>
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {filtered.map((product) => {
                const chosen = selected.includes(product.id);
                return (
                  <button key={product.id} type="button" onClick={() => toggle(product.id)} className="relative overflow-hidden rounded-md border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-pressed={chosen}>
                    <div className="aspect-square bg-muted"><img src={product.image_url || ""} alt="" className="h-full w-full object-cover" loading="lazy" /></div>
                    <p className="truncate px-2 py-1.5 text-xs font-medium">{product.name}</p>
                    {chosen && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" /></span>}
                  </button>
                );
              })}
            </div>
          )}
          {!isLoading && products.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Add product photos to this category first.</p>}
        </div>
        <DialogFooter className="border-t px-5 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setSelected([])}><Sparkles className="mr-2 h-4 w-4" />Use automatic</Button>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save photos</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}