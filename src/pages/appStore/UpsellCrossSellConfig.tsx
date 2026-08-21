import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Save, Trash2, ShoppingBag, TrendingUp, Eye, MousePointerClick, DollarSign } from "lucide-react";
import MultiProductPicker from "@/components/appStore/MultiProductPicker";
import { toast } from "sonner";
import { AppConfigShell, AppLiveBadge, AppSectionCard } from "@/components/appStore/AppConfigShell";
import {
  UPSELL_APP_ID,
  DEFAULT_UPSELL_CONFIG,
  newUpsellOffer,
  type UpsellOffer,
  type UpsellPlacement,
  type UpsellStrategy,
  type UpsellIncentiveType,
  type UpsellTriggerType,
} from "@/lib/appStore/upsell/types";

const PLACEMENT_LABELS: Record<UpsellPlacement, string> = {
  pdp: "Product page",
  cart_drawer: "Cart drawer",
  cart_page: "Cart page",
  pre_checkout: "Before checkout",
  post_purchase: "After purchase (coming soon)",
};

const PLACEMENT_DISABLED: Partial<Record<UpsellPlacement, boolean>> = {
  // Not yet wired end-to-end — hide from picker to avoid silent misconfig.
  post_purchase: true,
};

const STRATEGY_LABELS: Record<UpsellStrategy, string> = {
  manual: "Manual — I pick the products",
  auto_best_sellers: "Auto — Best sellers",
  auto_same_category: "Auto — Same category",
  auto_frequently_bought: "Auto — Frequently bought together (Phase 2)",
  auto_ai: "Auto — AI-picked (Phase 2)",
};

export default function UpsellCrossSellConfig() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const qc = useQueryClient();

  const { data: row, isLoading } = useQuery({
    queryKey: ["store-app", storeId, UPSELL_APP_ID],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_apps")
        .select("*")
        .eq("store_id", storeId!)
        .eq("app_id", UPSELL_APP_ID)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Analytics (last 30 days)
  const { data: analytics } = useQuery({
    queryKey: ["upsell-analytics", storeId],
    enabled: !!storeId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("upsell_events")
        .select("event_type, revenue_paise, offer_id")
        .eq("store_id", storeId!)
        .gte("created_at", since);
      if (error) return { views: 0, adds: 0, revenue: 0, byOffer: {} as Record<string, { views: number; adds: number; revenue: number }> };
      let views = 0, adds = 0, revenue = 0;
      const byOffer: Record<string, { views: number; adds: number; revenue: number }> = {};
      for (const r of data || []) {
        const oid = r.offer_id as string;
        if (!byOffer[oid]) byOffer[oid] = { views: 0, adds: 0, revenue: 0 };
        if (r.event_type === "view") { views++; byOffer[oid].views++; }
        else if (r.event_type === "add") { adds++; byOffer[oid].adds++; }
        else if (r.event_type === "purchase") {
          const rev = Number(r.revenue_paise || 0) / 100;
          revenue += rev;
          byOffer[oid].revenue += rev;
        }
      }
      return { views, adds, revenue, byOffer };
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [offers, setOffers] = useState<UpsellOffer[]>([]);

  useEffect(() => {
    if (!row) {
      setEnabled(false);
      setOffers([]);
      return;
    }
    setEnabled(!!row.enabled);
    setOffers((row.config?.offers ?? DEFAULT_UPSELL_CONFIG.offers) as UpsellOffer[]);
  }, [row]);

  const save = useMutation({
    mutationFn: async (opts?: { enabled?: boolean }) => {
      if (!storeId) throw new Error("Missing store");
      const nextEnabled = opts?.enabled ?? enabled;
      // Basic validation
      for (const o of offers) {
        if (!o.name.trim()) throw new Error("Every offer needs a name");
        if (!o.placements?.length) throw new Error(`"${o.name}" needs at least one placement`);
      }
      const payload = {
        store_id: storeId,
        app_id: UPSELL_APP_ID,
        enabled: nextEnabled,
        config: { offers } as any,
      };
      const { error } = await (supabase as any).from("store_apps").upsert(payload, {
        onConflict: "store_id,app_id",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Upsell settings saved");
      qc.invalidateQueries({ queryKey: ["store-app", storeId, UPSELL_APP_ID] });
      qc.invalidateQueries({ queryKey: ["store-apps", storeId] });
      qc.invalidateQueries({ queryKey: ["store-enabled-apps"] });
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const addOffer = () => {
    setOffers((prev) => [...prev, newUpsellOffer(prev.length)]);
  };

  const updateOffer = (id: string, patch: Partial<UpsellOffer>) => {
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const removeOffer = (id: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== id));
  };

  const togglePlacement = (id: string, p: UpsellPlacement) => {
    setOffers((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const has = o.placements.includes(p);
        return {
          ...o,
          placements: has ? o.placements.filter((x) => x !== p) : [...o.placements, p],
        };
      })
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppConfigShell
      storeSlug={storeSlug}
      icon={<ShoppingBag className="h-4.5 w-4.5" />}
      accent="from-emerald-500 to-teal-600"
      title="Upsell & Cross-sell"
      subtitle="Layer discounts on PDP, cart, checkout & thank-you"
      enabled={enabled}
      onEnabledChange={(v) => {
        setEnabled(v);
        save.mutate({ enabled: v });
      }}
      onSave={() => save.mutate({})}
      saving={save.isPending}
      saveLabel="Save changes"
      statusBadge={<AppLiveBadge enabled={enabled} />}
    >
      {/* Analytics strip */}
      <AppSectionCard title="Performance" description="Last 30 days" padded={true}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatTile icon={<Eye className="h-4 w-4" />} label="Views" value={analytics?.views ?? 0} />
          <StatTile icon={<MousePointerClick className="h-4 w-4" />} label="Adds" value={analytics?.adds ?? 0} />
          <StatTile
            icon={<DollarSign className="h-4 w-4" />}
            label="Revenue"
            value={`₹${Math.round(analytics?.revenue ?? 0).toLocaleString("en-IN")}`}
          />
          <StatTile
            icon={<TrendingUp className="h-4 w-4" />}
            label="Conv."
            value={`${analytics?.views ? Math.round(((analytics.adds || 0) / analytics.views) * 100) : 0}%`}
          />
        </div>
      </AppSectionCard>


      <div className="space-y-3 px-0 md:px-0">
        {offers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No offers yet. Create your first upsell to start lifting AOV.
              </p>
              <Button onClick={addOffer}><Plus className="h-4 w-4 mr-1" /> New offer</Button>
            </CardContent>
          </Card>
        )}

        {offers.map((offer) => (
          <Card key={offer.id}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div className="flex-1">
                <Input
                  value={offer.name}
                  onChange={(e) => updateOffer(offer.id, { name: e.target.value })}
                  placeholder="Offer name (internal)"
                  className="text-base font-semibold border-0 shadow-none px-0 focus-visible:ring-0"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {offer.placements.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">
                      {PLACEMENT_LABELS[p]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={offer.active}
                  onCheckedChange={(v) => updateOffer(offer.id, { active: v })}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeOffer(offer.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Placements */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Where should this show?
                </Label>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(Object.keys(PLACEMENT_LABELS) as UpsellPlacement[]).map((p) => {
                    const disabled = !!PLACEMENT_DISABLED[p];
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && togglePlacement(offer.id, p)}
                        className={`text-xs px-3 py-2 rounded-md border text-left transition-colors ${
                          disabled
                            ? "border-dashed border-border text-muted-foreground opacity-60 cursor-not-allowed"
                            : offer.placements.includes(p)
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        {PLACEMENT_LABELS[p]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Trigger */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Who sees it?</Label>
                  <Select
                    value={offer.trigger.type}
                    onValueChange={(v) =>
                      updateOffer(offer.id, { trigger: { ...offer.trigger, type: v as UpsellTriggerType } })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Everyone</SelectItem>
                      <SelectItem value="product">Cart contains specific products</SelectItem>
                      <SelectItem value="cart_value">Cart value ≥ threshold</SelectItem>
                      <SelectItem value="cart_qty">Cart qty ≥ threshold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(offer.trigger.type === "cart_value" || offer.trigger.type === "cart_qty") && (
                  <div>
                    <Label className="text-xs">
                      Minimum {offer.trigger.type === "cart_value" ? "cart value" : "quantity"}
                    </Label>
                    <Input
                      type="number"
                      value={
                        offer.trigger.type === "cart_value"
                          ? offer.trigger.min_cart_value ?? 0
                          : offer.trigger.min_qty ?? 0
                      }
                      onChange={(e) => {
                        const n = Number(e.target.value) || 0;
                        updateOffer(offer.id, {
                          trigger: {
                            ...offer.trigger,
                            ...(offer.trigger.type === "cart_value"
                              ? { min_cart_value: n }
                              : { min_qty: n }),
                          },
                        });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Recommendation strategy */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">What to recommend</Label>
                  <Select
                    value={offer.recommend.mode}
                    onValueChange={(v) =>
                      updateOffer(offer.id, {
                        recommend: { ...offer.recommend, mode: v as UpsellStrategy },
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STRATEGY_LABELS) as UpsellStrategy[]).map((s) => (
                        <SelectItem key={s} value={s}>{STRATEGY_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">How many items</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={offer.recommend.max_items}
                    onChange={(e) =>
                      updateOffer(offer.id, {
                        recommend: {
                          ...offer.recommend,
                          max_items: Math.min(12, Math.max(1, Number(e.target.value) || 4)),
                        },
                      })
                    }
                  />
                </div>
              </div>

              {offer.recommend.mode === "manual" && (
                <div>
                  <Label className="text-xs">Products to recommend</Label>
                  <MultiProductPicker
                    storeId={storeId}
                    value={offer.recommend.product_ids || []}
                    onChange={(ids) =>
                      updateOffer(offer.id, {
                        recommend: { ...offer.recommend, product_ids: ids },
                      })
                    }
                    max={12}
                    placeholder="Pick products to recommend..."
                  />
                  {(!offer.recommend.product_ids || offer.recommend.product_ids.length === 0) && (
                    <p className="mt-1.5 text-[11px] text-amber-600">
                      ⚠️ No products picked — this offer will not show on the storefront until you add at least one product.
                    </p>
                  )}
                </div>
              )}

              {offer.trigger.type === "product" && (
                <div>
                  <Label className="text-xs">Trigger when cart contains any of these products</Label>
                  <MultiProductPicker
                    storeId={storeId}
                    value={offer.trigger.product_ids || []}
                    onChange={(ids) =>
                      updateOffer(offer.id, {
                        trigger: { ...offer.trigger, product_ids: ids },
                      })
                    }
                    max={50}
                    placeholder="Pick trigger products..."
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Exclude these products from recommendations</Label>
                <MultiProductPicker
                  storeId={storeId}
                  value={offer.recommend.exclude_ids || []}
                  onChange={(ids) =>
                    updateOffer(offer.id, {
                      recommend: { ...offer.recommend, exclude_ids: ids },
                    })
                  }
                  max={50}
                  placeholder="Nothing excluded (optional)..."
                />
              </div>

              {/* Per-offer analytics */}
              {analytics?.byOffer?.[offer.id] && (
                <div className="flex gap-3 text-[11px] text-muted-foreground pt-2 border-t">
                  <span>Views: <strong className="text-foreground">{analytics.byOffer[offer.id].views}</strong></span>
                  <span>Adds: <strong className="text-foreground">{analytics.byOffer[offer.id].adds}</strong></span>
                  <span>Revenue: <strong className="text-foreground">₹{Math.round(analytics.byOffer[offer.id].revenue).toLocaleString("en-IN")}</strong></span>
                </div>
              )}

              {/* Incentive */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Discount type</Label>
                  <Select
                    value={offer.incentive?.type ?? "none"}
                    onValueChange={(v) =>
                      updateOffer(offer.id, {
                        incentive: {
                          ...(offer.incentive ?? { applies_to: "recommended_only" }),
                          type: v as UpsellIncentiveType,
                          value: offer.incentive?.value ?? 0,
                        },
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No discount</SelectItem>
                      <SelectItem value="percent_off">% off</SelectItem>
                      <SelectItem value="flat_off">₹ off</SelectItem>
                      <SelectItem value="free_gift">Free gift</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {offer.incentive && offer.incentive.type !== "none" && offer.incentive.type !== "free_gift" && (
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      value={offer.incentive.value ?? 0}
                      onChange={(e) =>
                        updateOffer(offer.id, {
                          incentive: { ...offer.incentive!, value: Number(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={offer.display.title}
                    onChange={(e) =>
                      updateOffer(offer.id, {
                        display: { ...offer.display, title: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Subtitle</Label>
                  <Input
                    value={offer.display.subtitle ?? ""}
                    onChange={(e) =>
                      updateOffer(offer.id, {
                        display: { ...offer.display, subtitle: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {offers.length > 0 && (
          <Button variant="outline" onClick={addOffer} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Add another offer
          </Button>
        )}
      </div>

    </AppConfigShell>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-extrabold leading-tight">{value}</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}