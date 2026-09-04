import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Download,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

export interface StudioCardData {
  type: "image_studio";
  brief?: string;
  preset?: string;
  category_id?: string | null;
  category_name?: string | null;
  product_id?: string | null;
  products?: Array<{ id: string; name: string; image_url: string | null }>;
}

interface Props {
  storeId?: string;
  data: StudioCardData;
}

type Product = { id: string; name: string; image_url: string | null };
type Category = { id: string; name: string; product_count: number };
type Creative = { id: string; image_url: string; attached?: boolean; preset?: string };

const PRESETS = [
  { id: "clean_white", label: "Clean catalogue", hint: "White studio background" },
  { id: "festive_offer", label: "Festive offer", hint: "Diwali / sale creative" },
  { id: "lifestyle", label: "Lifestyle", hint: "Styled real-life scene" },
  { id: "luxury_dark", label: "Premium dark", hint: "Dark, reflective, luxe" },
  { id: "model_ready", label: "On model", hint: "Worn / in use" },
  { id: "banner_wide", label: "Store banner", hint: "Wide homepage hero" },
];

const ASPECTS = [
  { id: "square", label: "1:1" },
  { id: "portrait", label: "4:5" },
  { id: "story", label: "9:16" },
  { id: "wide", label: "16:9" },
];

export default function ImageStudioCard({ storeId, data }: Props) {
  const [step, setStep] = useState<"pick" | "studio">(data.product_id ? "studio" : "pick");
  const [products, setProducts] = useState<Product[]>(data.products ?? []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(data.category_id ?? null);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  const [product, setProduct] = useState<Product | null>(
    data.product_id ? (data.products ?? []).find((p) => p.id === data.product_id) ?? null : null,
  );
  const [gallery, setGallery] = useState<Array<{ id: string; image_url: string }>>([]);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  const [preset, setPreset] = useState(data.preset || "clean_white");
  const [aspect, setAspect] = useState("square");
  const [brief, setBrief] = useState(data.brief || "");
  const [generating, setGenerating] = useState(false);
  const [creative, setCreative] = useState<Creative | null>(null);
  const [makePrimary, setMakePrimary] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const call = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      if (!storeId) throw new Error("No store selected");
      const { data: res, error } = await supabase.functions.invoke("assistant-image-studio", {
        body: { action, store_id: storeId, ...payload },
      });
      if (error) {
        // Edge function errors carry the real message in the response body.
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          if (parsed?.error) msg = parsed.error;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }
      if ((res as any)?.error) throw new Error((res as any).error);
      return res as any;
    },
    [storeId],
  );

  /* ---------------------------- product browsing ---------------------------- */

  useEffect(() => {
    if (step !== "pick" || !storeId) return;
    let cancelled = false;
    call("categories")
      .then((r) => !cancelled && setCategories(r.categories ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [step, storeId, call]);

  useEffect(() => {
    if (step !== "pick" || !storeId) return;
    let cancelled = false;
    setLoadingList(true);
    const t = setTimeout(() => {
      call("products", { category_id: categoryId, q: search.trim() || undefined, limit: 24 })
        .then((r) => !cancelled && setProducts(r.products ?? []))
        .catch(() => {})
        .finally(() => !cancelled && setLoadingList(false));
    }, search ? 320 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, storeId, categoryId, search, call]);

  const chooseProduct = async (p: Product) => {
    setProduct(p);
    setStep("studio");
    setCreative(null);
    setGallery([]);
    setSourceUrl(p.image_url ?? null);
    try {
      const r = await call("product_media", { product_id: p.id });
      const imgs = (r.images ?? []).filter((i: any) => !!i.image_url);
      setGallery(imgs);
      setSourceUrl((cur) => cur ?? imgs[0]?.image_url ?? null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  /* ------------------------------- generation ------------------------------- */

  const generate = async () => {
    if (!product) return;
    setGenerating(true);
    setCreative(null);
    try {
      const r = await call("generate", {
        product_id: product.id,
        source_image_url: sourceUrl || undefined,
        brief: brief.trim() || undefined,
        preset,
        aspect,
      });
      setCreative(r.creative);
      setMakePrimary(false);
    } catch (e: any) {
      toast.error(e.message || "Could not generate the image.");
    } finally {
      setGenerating(false);
    }
  };

  const attach = async () => {
    if (!creative || !product) return;
    setAttaching(true);
    try {
      await call("attach", { creative_id: creative.id, product_id: product.id, make_primary: makePrimary });
      setCreative({ ...creative, attached: true });
      toast.success(makePrimary ? "Added and set as the main product photo." : "Added to the product page.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAttaching(false);
    }
  };

  const detach = async () => {
    if (!creative) return;
    setAttaching(true);
    try {
      await call("detach", { creative_id: creative.id });
      setCreative({ ...creative, attached: false });
      toast.success("Removed from the product page.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAttaching(false);
    }
  };

  const aspectClass = useMemo(
    () =>
      aspect === "wide"
        ? "aspect-video"
        : aspect === "story"
          ? "aspect-[9/16]"
          : aspect === "portrait"
            ? "aspect-[4/5]"
            : "aspect-square",
    [aspect],
  );

  /* --------------------------------- render --------------------------------- */

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div
        className="flex items-center gap-2 border-b border-border/60 px-3.5 py-2.5"
        style={{
          backgroundImage:
            "linear-gradient(120deg, hsl(var(--primary) / 0.12) 0%, hsl(var(--card)) 70%)",
        }}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold tracking-tight">AI Product Image Studio</span>
        {product && step === "studio" && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 rounded-full px-2 text-[11px] text-muted-foreground"
            onClick={() => {
              setStep("pick");
              setCreative(null);
            }}
          >
            <ArrowLeft className="h-3 w-3" /> Change product
          </Button>
        )}
      </div>

      {step === "pick" ? (
        <div className="space-y-3 p-3.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your products…"
              className="h-9 rounded-xl pl-8 text-[13px]"
            />
          </div>

          {categories.length > 0 && (
            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                  !categoryId ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground",
                )}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                    categoryId === c.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground",
                  )}
                >
                  {c.name} <span className="opacity-60">{c.product_count}</span>
                </button>
              ))}
            </div>
          )}

          {loadingList ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-muted-foreground">
              No products found. Add a product with a photo first.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => chooseProduct(p)}
                  className="group overflow-hidden rounded-xl border border-border/70 bg-background text-left transition-colors hover:border-primary/50"
                >
                  <div className="aspect-square bg-muted">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImagePlus className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 px-1.5 py-1.5 text-[11px] leading-tight">{p.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5 p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted">
              {sourceUrl && <img src={sourceUrl} alt={product?.name ?? ""} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{product?.name}</p>
              <p className="text-[11px] text-muted-foreground">Source photo used by the AI</p>
            </div>
          </div>

          {gallery.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {gallery.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSourceUrl(g.image_url)}
                  className={cn(
                    "h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                    sourceUrl === g.image_url ? "border-primary" : "border-transparent opacity-70",
                  )}
                >
                  <img src={g.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={cn(
                  "rounded-xl border px-2.5 py-2 text-left transition-colors",
                  preset === p.id ? "border-primary/60 bg-primary/10" : "border-border/70 hover:bg-accent",
                )}
              >
                <span className="block text-[12px] font-medium leading-tight">{p.label}</span>
                <span className="block text-[10.5px] leading-tight text-muted-foreground">{p.hint}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Size</span>
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAspect(a.id)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  aspect === a.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>

          <Textarea
            rows={2}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Anything specific? e.g. Diwali background with diyas, keep the product centred"
            className="min-h-[56px] resize-none rounded-xl text-[12.5px]"
          />

          <Button onClick={generate} disabled={generating || !product} className="w-full gap-2 rounded-xl">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {generating ? "Creating your image…" : creative ? "Generate again" : "Generate image"}
          </Button>

          {generating && (
            <div className={cn("w-full animate-pulse rounded-xl bg-muted", aspectClass)} />
          )}

          {creative && !generating && (
            <div className="space-y-2.5 rounded-xl border border-border/70 p-2.5">
              <img
                src={creative.image_url}
                alt={`AI creative for ${product?.name ?? "product"}`}
                className="w-full rounded-lg object-cover"
              />
              {creative.attached ? (
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <Check className="h-3 w-3" /> On the product page
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 rounded-full text-[11.5px] text-muted-foreground"
                    onClick={detach}
                    disabled={attaching}
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              ) : (
                <>
                  <label className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
                    <span className="text-[12px]">Set as main product photo</span>
                    <Switch checked={makePrimary} onCheckedChange={setMakePrimary} />
                  </label>
                  <Button onClick={attach} disabled={attaching} className="w-full gap-2 rounded-xl">
                    {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    Add to product page
                  </Button>
                </>
              )}
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 rounded-xl text-[12px]"
                  onClick={generate}
                  disabled={generating}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Try another
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-[12px]" asChild>
                  <a href={creative.image_url} target="_blank" rel="noreferrer" download>
                    <Download className="h-3.5 w-3.5" /> Save
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
