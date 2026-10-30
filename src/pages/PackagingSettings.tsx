import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Upload, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoryPackagingSchema } from "@/lib/categoryPackaging";
import { generateUploadPath, uploadOptimizedImage } from "@/lib/uploadOptimizedImage";
import { isUtkalContentStore } from "../../supabase/functions/_shared/utkalContent";

export default function PackagingSettings() {
  const { store, storeId, isLoading } = useDashboardStore();
  const { user } = useAuth();
  const qc = useQueryClient();
  const eligible = isUtkalContentStore(store);
  const [categoryId, setCategoryId] = useState("");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [active, setActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const categories = useQuery({
    queryKey: ["packaging-categories", storeId], enabled: eligible && !!storeId,
    queryFn: async () => {
      if (!storeId) return [];
      const rows: { id: string; name: string }[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("categories").select("id,name").eq("store_id", storeId).order("name").order("id").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
  const settings = useQuery({
    queryKey: ["packaging-settings", storeId], enabled: eligible && !!storeId,
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase.from("category_packaging_options").select("*").eq("store_id", storeId).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const saved = settings.data?.find(row => row.category_id === categoryId);
  useEffect(() => {
    setLabel(saved?.label ?? ""); setPrice(saved ? String(saved.surcharge) : "");
    setImageUrl(saved?.image_url ?? ""); setActive(saved?.is_active ?? true);
  }, [categoryId, saved]);
  async function upload(file?: File) {
    if (!file || !user || !storeId) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error("Choose a JPG, PNG or WebP photo under 10 MB"); return;
    }
    setUploading(true);
    try {
      const result = await uploadOptimizedImage(file, "store-assets", generateUploadPath(user.id, storeId));
      setImageUrl(result.mainUrl);
      toast.success("Box photo uploaded");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Photo upload failed"); }
    finally { setUploading(false); }
  }
  async function save() {
    if (!storeId || saving) return;
    const parsed = categoryPackagingSchema.safeParse({ category_id: categoryId, label, image_url: imageUrl, surcharge: price.trim() ? Number(price) : NaN, is_active: active });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the box details"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("category_packaging_options").upsert({ ...parsed.data, store_id: storeId }, { onConflict: "store_id,category_id" });
      if (error) throw error;
      await Promise.all([qc.invalidateQueries({ queryKey: ["packaging-settings", storeId] }), qc.invalidateQueries({ queryKey: ["product-packaging", storeId] }), qc.invalidateQueries({ queryKey: ["checkout-packaging", storeId] })]);
      toast.success("Category packaging saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save packaging"); }
    finally { setSaving(false); }
  }
  if (isLoading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!eligible) return <div className="p-6 text-muted-foreground">Packaging settings are available only for Utkal Watch.</div>;
  if (categories.isError || settings.isError) return <div className="p-6 space-y-3"><p>Could not load packaging settings.</p><Button onClick={() => { void categories.refetch(); void settings.refetch(); }}>Retry</Button></div>;
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
    <header className="flex items-center gap-3"><Package className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Packaging</h1></header>
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form className="min-w-0 space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}>
        <div className="space-y-2"><Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={saving || uploading || categories.isLoading || settings.isLoading}>
            <SelectTrigger aria-label="Category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
            <SelectContent><div className="p-2"><Input aria-label="Search categories" placeholder="Search categories" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.stopPropagation()} /></div>
              {categories.data?.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="box-name">Third box name</Label><Input id="box-name" maxLength={80} value={label} onChange={e => setLabel(e.target.value)} placeholder="Gift box" disabled={!categoryId || saving} /></div>
        <div className="space-y-2"><Label htmlFor="box-price">Extra price per watch (₹)</Label><Input id="box-price" type="number" min="0" max="10000" step="0.01" value={price} onChange={e => setPrice(e.target.value)} disabled={!categoryId || saving} /></div>
        <div className="space-y-2"><Label htmlFor="box-photo">Box photo</Label><Input id="box-photo" aria-label="Box photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={!categoryId || uploading || saving} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />{uploading && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Upload className="h-4 w-4" />Uploading photo…</span>}</div>
        <div className="flex items-center justify-between"><Label htmlFor="box-active">Available to customers</Label><Switch id="box-active" checked={active} onCheckedChange={setActive} disabled={!categoryId || saving} /></div>
        <Button type="submit" disabled={!categoryId || uploading || saving || settings.isLoading}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save packaging"}</Button>
      </form>
      <section className="min-w-0 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Third packaging choice</h2>
        {imageUrl ? <img src={imageUrl} alt={label || "Box photo"} className="aspect-square w-full max-w-sm rounded-lg border border-border object-contain" /> : <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-lg border border-dashed border-border bg-muted"><Package className="h-12 w-12 text-muted-foreground" /></div>}
        <div className="flex items-start justify-between gap-3"><p className="break-words font-semibold">{label || "No box selected"}</p><span className="shrink-0 text-sm">{price ? `+₹${price}` : "—"}</span></div>
        {categoryId && <p className="text-sm text-muted-foreground">{active ? "Available" : "Unavailable"} · {categories.data?.find(c => c.id === categoryId)?.name}</p>}
      </section>
    </div>
    <section className="border-t border-border pt-5"><h2 className="mb-3 text-lg font-semibold">Saved category boxes</h2><div className="space-y-2">{settings.data?.length === 0 && <p className="text-sm text-muted-foreground">No category boxes saved yet.</p>}{settings.data?.map(row => <Button key={row.id} variant="outline" className="h-auto w-full justify-start gap-3 p-3 text-left" disabled={uploading || saving} onClick={() => setCategoryId(row.category_id)}><img src={row.image_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 object-contain" /><span className="min-w-0 flex-1 whitespace-normal"><span className="block font-semibold">{row.label}</span><span className="block text-xs text-muted-foreground">{categories.data?.find(c => c.id === row.category_id)?.name} · {row.is_active ? "Available" : "Unavailable"}</span></span><span className="shrink-0">+₹{row.surcharge}</span></Button>)}</div></section>
  </main>;
}