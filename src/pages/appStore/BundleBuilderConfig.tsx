import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Save, Package, Plus, Trash2, ImagePlus, Copy, ExternalLink, X, ChevronDown, ChevronRight,
} from "lucide-react";
import MediaLibraryPicker from "@/components/MediaLibraryPicker";
import type { BundleDef, BundleAppConfig, BundleType, BundleDiscountMode } from "@/lib/appStore/bundle/types";
import { BUNDLE_APP_ID, DEFAULT_BUNDLE_CONFIG, slugifyBundleName, bundleTypeOf } from "@/lib/appStore/bundle/types";

const APP_ID = BUNDLE_APP_ID;

function newBundle(sortOrder: number): BundleDef {
  return {
    id: crypto.randomUUID(),
    slug: "",
    name: "",
    subheading: "",
    banner_url: "",
    type: "pick_n",
    discount_mode: "flat",
    discount_percent: 10,
    discount_amount: 0,
    fixed_children: [],
    fbt_anchor_product_ids: [],
    fbt_companion_product_ids: [],
    pick_count: 3,
    bundle_price: 899,
    include_categories: [],
    include_product_ids: [],
    exclude_product_ids: [],
    is_active: true,
    sort_order: sortOrder,
  };
}

export default function BundleBuilderConfig() {
  const { storeId, storeSlug, store } = useStoreSlugParam();
  const qc = useQueryClient();

  const { data: row, isLoading } = useQuery({
    queryKey: ["store-app", storeId, APP_ID],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_apps")
        .select("*")
        .eq("store_id", storeId!)
        .eq("app_id", APP_ID)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id,name,slug")
        .eq("store_id", storeId!)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; slug: string }[];
    },
  });

  const { data: allProducts } = useQuery({
    queryKey: ["bundle-config-products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id,name,slug,image_url,price,sale_price,category,is_active")
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [cfg, setCfg] = useState<BundleAppConfig>(DEFAULT_BUNDLE_CONFIG);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setEnabled(!!row.enabled);
      setCfg({ bundles: (row.config?.bundles ?? []) as BundleDef[] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const upsert = useMutation({
    mutationFn: async () => {
      // Validate before persisting so a broken bundle can never reach shoppers.
      for (const b of cfg.bundles) {
        if (!b.name?.trim()) throw new Error("Every bundle needs a name");
        const t = bundleTypeOf(b);
        const mode: BundleDiscountMode = (b.discount_mode as BundleDiscountMode) || "flat";
        if (t === "pick_n") {
          if (!(b.pick_count >= 1 && b.pick_count <= 20)) {
            throw new Error(`"${b.name}" — pick count must be between 1 and 20`);
          }
          if (!(Number(b.bundle_price) > 0)) {
            throw new Error(`"${b.name}" — set a bundle price greater than 0`);
          }
          const hasPool =
            (b.include_categories?.length ?? 0) > 0 ||
            (b.include_product_ids?.length ?? 0) > 0;
          if (!hasPool) {
            throw new Error(`"${b.name}" — add at least one category or product to the pool`);
          }
        } else if (t === "fixed") {
          if ((b.fixed_children?.length ?? 0) < 2) {
            throw new Error(`"${b.name}" — a fixed combo needs at least 2 products`);
          }
        } else if (t === "fbt") {
          if ((b.fbt_anchor_product_ids?.length ?? 0) < 1) {
            throw new Error(`"${b.name}" — pick at least 1 anchor product`);
          }
          if ((b.fbt_companion_product_ids?.length ?? 0) < 1) {
            throw new Error(`"${b.name}" — pick at least 1 companion product`);
          }
        }
        // Pricing validation for fixed / fbt.
        if (t !== "pick_n") {
          if (mode === "flat" && !(Number(b.bundle_price) > 0)) {
            throw new Error(`"${b.name}" — set a combo price greater than 0`);
          }
          if (mode === "percent_off" && !(Number(b.discount_percent) > 0 && Number(b.discount_percent) < 100)) {
            throw new Error(`"${b.name}" — percent off must be between 1 and 99`);
          }
          if (mode === "amount_off" && !(Number(b.discount_amount) > 0)) {
            throw new Error(`"${b.name}" — amount off must be greater than 0`);
          }
        }
      }
      // sanitize slugs (auto-generate, avoid collisions)
      const seen = new Set<string>();
      const bundles = cfg.bundles.map((b, idx) => {
        // Always run through the slugifier so user-typed slugs with spaces / caps
        // (e.g. "Get 3 Attar At 899") get normalised to URL-safe form.
        let slug = slugifyBundleName((b.slug || b.name || "").trim());
        if (!slug) slug = `bundle-${idx + 1}`;
        const base = slug;
        let n = 1;
        while (seen.has(slug)) slug = `${base}-${++n}`;
        seen.add(slug);
        return { ...b, slug, sort_order: idx };
      });
      const { error } = await (supabase as any)
        .from("store_apps")
        .upsert(
          { store_id: storeId, app_id: APP_ID, enabled, config: { bundles } },
          { onConflict: "store_id,app_id" },
        );
      if (error) throw error;
      return bundles;
    },
    onSuccess: (bundles) => {
      setCfg({ bundles });
      qc.invalidateQueries({ queryKey: ["store-app", storeId, APP_ID] });
      qc.invalidateQueries({ queryKey: ["store-apps", storeId] });
      qc.invalidateQueries({ queryKey: ["storefront-bundles"] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const updateBundle = (id: string, patch: Partial<BundleDef>) => {
    setCfg((c) => ({ bundles: c.bundles.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  };
  const removeBundle = (id: string) => setCfg((c) => ({ bundles: c.bundles.filter((b) => b.id !== id) }));
  const addBundle = () => {
    const b = newBundle(cfg.bundles.length);
    setCfg((c) => ({ bundles: [...c.bundles, b] }));
    setExpandedId(b.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const bundlesPublicUrl = store?.slug ? `/store/${store.slug}/bundles` : null;

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/dashboard/stores/${storeSlug}/apps`}>
            <ArrowLeft className="h-4 w-4 mr-1" /> App Store
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Bundle Builder</h1>
            {enabled ? <Badge className="bg-emerald-500">Live</Badge> : <Badge variant="secondary">Disabled</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Create combo offers — <strong>Pick N</strong> (any N for a flat price), <strong>Fixed Combo</strong> (curated set), or <strong>Frequently Bought Together</strong> (anchor + companions). A Bundles menu appears automatically in your storefront when at least one bundle is active.
          </p>
        </div>
        <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} className="gap-2">
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Enable on storefront</CardTitle>
              <CardDescription>Turns on the Bundles menu and /bundles page for shoppers.</CardDescription>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardHeader>
        {enabled && bundlesPublicUrl && (
          <CardContent className="pt-0">
            <a
              href={bundlesPublicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Preview /bundles
            </a>
          </CardContent>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Your bundles ({cfg.bundles.length})</h2>
        <Button onClick={addBundle} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add bundle
        </Button>
      </div>

      {cfg.bundles.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center">
              <Package className="h-7 w-7 text-rose-500" />
            </div>
            <div>
              <p className="font-semibold">No bundles yet</p>
              <p className="text-sm text-muted-foreground">Create your first "3 for ₹899" style combo offer.</p>
            </div>
            <Button onClick={addBundle} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Create first bundle
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {cfg.bundles.map((b, idx) => (
          <BundleRow
            key={b.id}
            bundle={b}
            idx={idx}
            storeId={storeId}
            categories={categories || []}
            allProducts={allProducts || []}
            expanded={expandedId === b.id}
            onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
            onChange={(patch) => updateBundle(b.id, patch)}
            onRemove={() => removeBundle(b.id)}
            onDuplicate={() => {
              const copy: BundleDef = {
                ...b,
                id: crypto.randomUUID(),
                name: `${b.name || "Bundle"} (copy)`,
                slug: "",
                sort_order: cfg.bundles.length,
              };
              setCfg((c) => ({ bundles: [...c.bundles, copy] }));
              setExpandedId(copy.id);
            }}
          />
        ))}
      </div>

      {cfg.bundles.length > 0 && (
        <div className="flex justify-end pt-4">
          <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} className="gap-2">
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Bundle row (collapsed summary + expanded editor)
// -----------------------------------------------------------------

interface RowProps {
  bundle: BundleDef;
  idx: number;
  storeId?: string;
  categories: { id: string; name: string; slug: string }[];
  allProducts: any[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<BundleDef>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

function BundleRow({ bundle, idx, storeId, categories, allProducts, expanded, onToggle, onChange, onRemove, onDuplicate }: RowProps) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const effType: BundleType = bundleTypeOf(bundle);
  const effMode: BundleDiscountMode = (bundle.discount_mode as BundleDiscountMode) || "flat";

  // Effective pool = (products in include_categories, plus manual include_product_ids)
  // minus exclude_product_ids. Empty include_categories = all products.
  const eligibleCount = useMemo(() => {
    const excludeSet = new Set(bundle.exclude_product_ids);
    const includeCats = new Set(bundle.include_categories);
    const manualIn = new Set(bundle.include_product_ids);
    return allProducts.filter((p) => {
      if (excludeSet.has(p.id)) return false;
      if (includeCats.size === 0) return true; // all products
      if (p.category && includeCats.has(p.category)) return true;
      if (manualIn.has(p.id)) return true;
      return false;
    }).length;
  }, [allProducts, bundle.include_categories, bundle.include_product_ids, bundle.exclude_product_ids]);

  const filteredProducts = useMemo(() => {
    const s = productSearch.trim().toLowerCase();
    if (!s) return allProducts.slice(0, 50);
    return allProducts.filter((p) => p.name?.toLowerCase().includes(s)).slice(0, 50);
  }, [allProducts, productSearch]);

  const toggleCategory = (name: string) => {
    const set = new Set(bundle.include_categories);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    onChange({ include_categories: Array.from(set) });
  };
  const toggleIncludeProduct = (id: string) => {
    const set = new Set(bundle.include_product_ids);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ include_product_ids: Array.from(set) });
  };
  const toggleExcludeProduct = (id: string) => {
    const set = new Set(bundle.exclude_product_ids);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ exclude_product_ids: Array.from(set) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex flex-1 items-center gap-3 text-left"
          >
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            {bundle.banner_url ? (
              <img src={bundle.banner_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-rose-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">
                {bundle.name || <span className="text-muted-foreground">Untitled bundle</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                Pick {bundle.pick_count} · ₹{bundle.bundle_price} · {eligibleCount} eligible product{eligibleCount === 1 ? "" : "s"}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {!bundle.is_active && <Badge variant="secondary" className="text-[10px]">Off</Badge>}
            <Switch
              checked={bundle.is_active}
              onCheckedChange={(v) => onChange({ is_active: v })}
              aria-label="Bundle active"
            />
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5 border-t pt-4">
          {/* -------- Bundle type selector (v2) -------- */}
          <div>
            <Label>Bundle type</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {([
                { id: "pick_n", label: "Pick N", hint: "Choose any N for a flat price" },
                { id: "fixed", label: "Fixed Combo", hint: "Curated set sold together" },
                { id: "fbt", label: "Frequently Bought Together", hint: "Anchor + companions" },
              ] as { id: BundleType; label: string; hint: string }[]).map((opt) => {
                const active = effType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ type: opt.id })}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* -------- Pricing mode (fixed / fbt) -------- */}
          {effType !== "pick_n" && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div>
                <Label className="text-xs">Discount mode</Label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {([
                    { id: "flat", label: "Flat combo price" },
                    { id: "percent_off", label: "% off MRP" },
                    { id: "amount_off", label: "₹ off MRP" },
                  ] as { id: BundleDiscountMode; label: string }[]).map((opt) => {
                    const active = effMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange({ discount_mode: opt.id })}
                        className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {effMode === "flat" && (
                  <div>
                    <Label>Combo price (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={bundle.bundle_price}
                      onChange={(e) => onChange({ bundle_price: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                )}
                {effMode === "percent_off" && (
                  <div>
                    <Label>Percent off</Label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={bundle.discount_percent ?? 10}
                      onChange={(e) => onChange({ discount_percent: Math.max(1, Math.min(99, Number(e.target.value) || 0)) })}
                    />
                  </div>
                )}
                {effMode === "amount_off" && (
                  <div>
                    <Label>Amount off (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={bundle.discount_amount ?? 0}
                      onChange={(e) => onChange({ discount_amount: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Basics */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Bundle name</Label>
              <Input
                value={bundle.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="e.g. Get 3 Attars at ₹899"
                maxLength={80}
              />
            </div>
            <div>
              <Label>URL slug</Label>
              <Input
                value={bundle.slug}
                onChange={(e) => onChange({ slug: e.target.value })}
                placeholder={slugifyBundleName(bundle.name) || "auto"}
                maxLength={60}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Public URL: /bundles/{bundle.slug || slugifyBundleName(bundle.name) || "…"}</p>
            </div>
            {effType === "pick_n" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pick count</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={bundle.pick_count}
                    onChange={(e) => onChange({ pick_count: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })}
                  />
                </div>
                <div>
                  <Label>Bundle price (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={bundle.bundle_price}
                    onChange={(e) => onChange({ bundle_price: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <Label>Subheading (optional)</Label>
              <Textarea
                value={bundle.subheading || ""}
                onChange={(e) => onChange({ subheading: e.target.value })}
                placeholder="Select any 3 Attar choice at just ₹899!"
                maxLength={160}
                rows={2}
              />
            </div>
          </div>

          {/* Banner */}
          <div>
            <Label>Banner image</Label>
            <div className="mt-1 flex items-center gap-3">
              {bundle.banner_url ? (
                <div className="relative">
                  <img src={bundle.banner_url} alt="" className="h-20 w-32 rounded-md object-cover border" />
                  <button
                    type="button"
                    onClick={() => onChange({ banner_url: "" })}
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-background border shadow flex items-center justify-center text-muted-foreground hover:text-destructive"
                    aria-label="Remove banner"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="h-20 w-32 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => setMediaOpen(true)}>
                  Choose from library
                </Button>
                <Input
                  placeholder="…or paste image URL"
                  value={bundle.banner_url || ""}
                  onChange={(e) => onChange({ banner_url: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Fixed combo — pick exact products */}
          {effType === "fixed" && (
            <div>
              <Label>Products in this combo</Label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Tap products to toggle them in the combo. All selected are sold together as one bundle.
              </p>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products…"
                className="mb-2 h-9"
              />
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {filteredProducts.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No products found.</p>
                )}
                {filteredProducts.map((p) => {
                  const picked = (bundle.fixed_children ?? []).includes(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 border-b last:border-b-0 p-2">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-muted" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.category || "Uncategorized"} · ₹{p.sale_price ?? p.price}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const set = new Set(bundle.fixed_children ?? []);
                          if (set.has(p.id)) set.delete(p.id); else set.add(p.id);
                          onChange({ fixed_children: Array.from(set) });
                        }}
                        className={`h-7 px-3 rounded text-[11px] font-semibold border ${picked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}
                      >
                        {picked ? "In combo" : "Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {(bundle.fixed_children?.length ?? 0)} product{(bundle.fixed_children?.length ?? 0) === 1 ? "" : "s"} in this combo
                {((bundle.fixed_children?.length ?? 0) < 2) && <span className="ml-2 text-destructive">⚠ Add at least 2.</span>}
              </p>
            </div>
          )}

          {/* FBT — anchors + companions */}
          {effType === "fbt" && (
            <div className="space-y-4">
              <div>
                <Label>Anchor products (this combo appears on these PDPs)</Label>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products…"
                  className="mt-1 mb-2 h-9"
                />
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  {filteredProducts.map((p) => {
                    const picked = (bundle.fbt_anchor_product_ids ?? []).includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 border-b last:border-b-0 p-2">
                        {p.image_url ? <img src={p.image_url} alt="" className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-muted" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">₹{p.sale_price ?? p.price}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const set = new Set(bundle.fbt_anchor_product_ids ?? []);
                            if (set.has(p.id)) set.delete(p.id); else set.add(p.id);
                            onChange({ fbt_anchor_product_ids: Array.from(set) });
                          }}
                          className={`h-7 px-3 rounded text-[11px] font-semibold border ${picked ? "border-emerald-500 bg-emerald-500 text-white" : "border-input bg-background hover:bg-accent"}`}
                        >
                          {picked ? "Anchor" : "+ Anchor"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{(bundle.fbt_anchor_product_ids?.length ?? 0)} anchor product{(bundle.fbt_anchor_product_ids?.length ?? 0) === 1 ? "" : "s"}</p>
              </div>
              <div>
                <Label>Companion products (offered alongside anchors)</Label>
                <div className="mt-1 max-h-56 overflow-y-auto rounded-md border">
                  {filteredProducts.map((p) => {
                    const picked = (bundle.fbt_companion_product_ids ?? []).includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 border-b last:border-b-0 p-2">
                        {p.image_url ? <img src={p.image_url} alt="" className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-muted" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">₹{p.sale_price ?? p.price}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const set = new Set(bundle.fbt_companion_product_ids ?? []);
                            if (set.has(p.id)) set.delete(p.id); else set.add(p.id);
                            onChange({ fbt_companion_product_ids: Array.from(set) });
                          }}
                          className={`h-7 px-3 rounded text-[11px] font-semibold border ${picked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}
                        >
                          {picked ? "Included" : "+ Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{(bundle.fbt_companion_product_ids?.length ?? 0)} companion product{(bundle.fbt_companion_product_ids?.length ?? 0) === 1 ? "" : "s"}</p>
              </div>
            </div>
          )}

          {/* Category filter — pick_n only */}
          {effType === "pick_n" && (
          <div>
            <Label>Which categories are eligible?</Label>
            <p className="text-[11px] text-muted-foreground mb-2">Leave empty to allow all products from your store.</p>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No categories yet — bundle will use all products.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const active = bundle.include_categories.includes(c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.name)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* Manual include / exclude — pick_n only */}
          {effType === "pick_n" && (
          <div>
            <Label>Manual product tweaks</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Tap ✓ to force-include a product outside the categories, or 🚫 to hide a product from the pool.
            </p>
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products…"
              className="mb-2 h-9"
            />
            <div className="max-h-64 overflow-y-auto rounded-md border">
              {filteredProducts.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">No products found.</p>
              )}
              {filteredProducts.map((p) => {
                const inc = bundle.include_product_ids.includes(p.id);
                const exc = bundle.exclude_product_ids.includes(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 border-b last:border-b-0 p-2">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-9 w-9 rounded object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.category || "Uncategorized"} · ₹{p.sale_price ?? p.price}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleIncludeProduct(p.id)}
                      className={`h-7 px-2 rounded text-[11px] font-semibold border ${
                        inc ? "border-emerald-500 bg-emerald-500 text-white" : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      ✓ Include
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExcludeProduct(p.id)}
                      className={`h-7 px-2 rounded text-[11px] font-semibold border ${
                        exc ? "border-destructive bg-destructive text-destructive-foreground" : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      🚫 Exclude
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Currently eligible: <span className="font-semibold text-foreground">{eligibleCount}</span> product{eligibleCount === 1 ? "" : "s"}
              {eligibleCount < bundle.pick_count && (
                <span className="ml-2 text-destructive">⚠ Fewer eligible than pick count.</span>
              )}
            </p>
          </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onDuplicate} className="gap-1">
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
              <Button variant="ghost" size="sm" onClick={onRemove} className="gap-1 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Position #{idx + 1}</p>
          </div>

          {storeId && (
            <MediaLibraryPicker
              storeId={storeId}
              open={mediaOpen}
              onClose={() => setMediaOpen(false)}
              onSelect={(urls) => {
                if (urls[0]) onChange({ banner_url: urls[0] });
                setMediaOpen(false);
              }}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}