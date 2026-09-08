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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Film, Eye, GripVertical, ArrowUp, ArrowDown, VideoOff } from "lucide-react";
import { getApp } from "@/lib/appStore/registry";
import ShopByVideoCarousel from "@/components/storefront/ShopByVideoCarousel";
import { AppConfigShell, AppLiveBadge } from "@/components/appStore/AppConfigShell";

const APP_ID = "shop-by-video";

interface Config {
  title: string;
  autoplay: boolean;
  loop: boolean;
  aspect_ratio: "9:16" | "4:5";
  max_items: number;
  show_price: boolean;
  show_cta: boolean;
  order: string[];
}

interface VideoProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  currency: string | null;
  image_url: string | null;
  video_url: string;
  video_poster_url: string | null;
}

export default function ShopByVideoConfig() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const qc = useQueryClient();
  const appMeta = getApp(APP_ID)!;
  const defaults = appMeta.defaultConfig as Config;

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

  const { data: videoProducts, isLoading: prodLoading } = useQuery({
    queryKey: ["shop-by-video-products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,slug,name,price,sale_price,currency,image_url,video_url,video_poster_url")
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[] as VideoProduct[]) || [];
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [cfg, setCfg] = useState<Config>(defaults);

  useEffect(() => {
    if (row) {
      setEnabled(!!row.enabled);
      setCfg({ ...defaults, ...(row.config || {}) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const orderedProducts = useMemo<VideoProduct[]>(() => {
    if (!videoProducts) return [];
    const byId = new Map(videoProducts.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const list: VideoProduct[] = [];
    for (const id of cfg.order || []) {
      const p = byId.get(id);
      if (p && !seen.has(id)) { list.push(p); seen.add(id); }
    }
    for (const p of videoProducts) if (!seen.has(p.id)) list.push(p);
    return list;
  }, [videoProducts, cfg.order]);

  const applyOrder = (list: VideoProduct[]) =>
    setCfg((c) => ({ ...c, order: list.map((p) => p.id) }));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...orderedProducts];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    applyOrder(next);
  };

  const moveToTop = (idx: number) => {
    if (idx <= 0) return;
    const next = [...orderedProducts];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    applyOrder(next);
  };


  const upsert = useMutation({
    mutationFn: async (payload: { enabled: boolean; config: Config }) => {
      const finalOrder = orderedProducts.map((p) => p.id);
      const { error } = await (supabase as any)
        .from("store_apps")
        .upsert(
          { store_id: storeId, app_id: APP_ID, enabled: payload.enabled, config: { ...payload.config, order: finalOrder } },
          { onConflict: "store_id,app_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-app", storeId, APP_ID] });
      qc.invalidateQueries({ queryKey: ["store-apps", storeId] });
      qc.invalidateQueries({ queryKey: ["store-enabled-apps"] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewProducts = orderedProducts.slice(0, Math.max(2, Math.min(30, cfg.max_items || 10)));

  return (
    <AppConfigShell
      storeSlug={storeSlug}
      icon={<Film className="h-4.5 w-4.5" />}
      accent="from-fuchsia-500 to-rose-500"
      title="Shop by Video"
      subtitle="Reels-style carousel under Best Sellers"
      enabled={enabled}
      onEnabledChange={(v) => {
        // Persist immediately — otherwise the switch only lives in local state
        // and the app looks enabled until the page is refreshed.
        setEnabled(v);
        upsert.mutate({ enabled: v, config: cfg });
      }}
      onSave={() => upsert.mutate({ enabled, config: cfg })}
      saving={upsert.isPending}
      saveLabel="Save changes"
      statusBadge={<AppLiveBadge enabled={enabled} />}
    >

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Look &amp; feel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Section title</Label>
            <Input value={cfg.title} onChange={(e) => setCfg({ ...cfg, title: e.target.value })} maxLength={40} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Card aspect ratio</Label>
              <div className="mt-1 flex gap-2">
                {(["9:16", "4:5"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setCfg({ ...cfg, aspect_ratio: a })}
                    className={`h-10 flex-1 rounded-lg border text-sm font-semibold transition-colors ${cfg.aspect_ratio === a ? "border-primary bg-primary/10 text-primary" : "border-input bg-background hover:bg-accent"}`}
                  >
                    {a === "9:16" ? "Tall (9:16)" : "Portrait (4:5)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Max videos ({cfg.max_items})</Label>
              <Input
                type="number"
                min={2}
                max={30}
                value={cfg.max_items}
                onChange={(e) => setCfg({ ...cfg, max_items: Math.max(2, Math.min(30, parseInt(e.target.value) || 10)) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Autoplay carousel</p>
                <p className="text-xs text-muted-foreground">Auto-scroll every 5s</p>
              </div>
              <Switch checked={cfg.autoplay} onCheckedChange={(v) => setCfg({ ...cfg, autoplay: v })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Loop</p>
                <p className="text-xs text-muted-foreground">Wrap around at the end</p>
              </div>
              <Switch checked={cfg.loop} onCheckedChange={(v) => setCfg({ ...cfg, loop: v })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Show price</p>
                <p className="text-xs text-muted-foreground">Display price on the video card</p>
              </div>
              <Switch checked={cfg.show_price} onCheckedChange={(v) => setCfg({ ...cfg, show_price: v })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Show "See details" CTA</p>
                <p className="text-xs text-muted-foreground">Button opens the product page</p>
              </div>
              <Switch checked={cfg.show_cta} onCheckedChange={(v) => setCfg({ ...cfg, show_cta: v })} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sequence</CardTitle>
          <CardDescription>
            Drag order controls to arrange which video appears first. New products with a video are added at the end automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prodLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : orderedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <VideoOff className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No products with a video yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Upload a video on any product from the product editor. It will show up here automatically — no need to add anything manually.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {orderedProducts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                    {p.video_poster_url || p.image_url ? (
                      <img src={p.video_poster_url || p.image_url!} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">Position #{i + 1}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveToTop(i)}
                      disabled={i === 0}
                      className="h-8 px-2 inline-flex items-center justify-center rounded-md border border-input bg-background text-[11px] font-semibold disabled:opacity-40 hover:bg-accent transition-colors"
                      aria-label="Move to first position"
                    >
                      Top
                    </button>
                    <button

                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === orderedProducts.length - 1}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-input bg-background disabled:opacity-40 hover:bg-accent transition-colors"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {previewProducts.length >= 2 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Live preview</CardTitle>
            </div>
            <CardDescription>Exactly how it will look on your storefront home.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border bg-background p-3">
              <ShopByVideoCarousel
                storeSlug={storeSlug!}
                storeId={storeId!}
                previewConfig={{ ...cfg, enabled: true }}
                previewProducts={previewProducts}
              />
            </div>
          </CardContent>
        </Card>
      )}

    </AppConfigShell>
  );
}
