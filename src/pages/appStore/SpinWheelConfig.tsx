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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Disc3, Loader2, Plus, Trash2, Eye, Save } from "lucide-react";
import { getApp } from "@/lib/appStore/registry";
import SpinWheelApp from "@/components/storefront/apps/SpinWheel/SpinWheelApp";
import type { SpinWheelConfig, WheelSegment, WheelStyle } from "@/components/storefront/apps/SpinWheel/types";
import { AppConfigShell, AppLiveBadge } from "@/components/appStore/AppConfigShell";

const APP_ID = "spin-wheel";

export default function SpinWheelConfigPage() {
  const { storeId, storeSlug, store } = useStoreSlugParam();
  const qc = useQueryClient();
  const appMeta = getApp(APP_ID)!;
  const defaults = appMeta.defaultConfig as SpinWheelConfig;

  const { data: themeCfg } = useQuery({
    queryKey: ["store-theme-config-preview", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("store_theme_config")
        .select("primary_color, accent_color")
        .eq("store_id", storeId!)
        .maybeSingle();
      return data || {};
    },
  });
  const previewPrimary = themeCfg?.primary_color || "#3b3ab5";
  const previewAccent = themeCfg?.accent_color || previewPrimary;

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

  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<SpinWheelConfig>(defaults);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (row) {
      setEnabled(!!row.enabled);
      setConfig({ ...defaults, ...(row.config || {}) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const upsert = useMutation({
    mutationFn: async (payload: { enabled: boolean; config: SpinWheelConfig }) => {
      const { error } = await (supabase as any)
        .from("store_apps")
        .upsert(
          { store_id: storeId, app_id: APP_ID, enabled: payload.enabled, config: payload.config },
          { onConflict: "store_id,app_id" }
        );
      if (error) throw error;

      const couponSegs = payload.config.segments.filter(
        (s) => s.type === "coupon" && s.code && (s.discount_value ?? 0) > 0
      );
      if (couponSegs.length > 0) {
        const { data: existing } = await (supabase as any)
          .from("coupons")
          .select("code")
          .eq("store_id", storeId!)
          .in("code", couponSegs.map((s) => s.code!.toUpperCase()));
        const existingSet = new Set((existing ?? []).map((r: any) => r.code));
        const toInsert = couponSegs
          .filter((s) => !existingSet.has(s.code!.toUpperCase()))
          .map((s) => ({
            store_id: storeId,
            code: s.code!.toUpperCase(),
            discount_type: s.discount_type === "flat" ? "fixed" : "percentage",
            discount_value: Number(s.discount_value) || 0,
            min_order_amount: Number(s.min_order) || 0,
            is_active: true,
          }));
        if (toInsert.length > 0) {
          const { error: cErr } = await (supabase as any).from("coupons").insert(toInsert);
          if (cErr) throw cErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-app", storeId, APP_ID] });
      qc.invalidateQueries({ queryKey: ["store-apps", storeId] });
      qc.invalidateQueries({ queryKey: ["coupons", storeId] });
      qc.invalidateQueries({ queryKey: ["store-enabled-apps"] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const uninstall = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("store_apps")
        .delete()
        .eq("store_id", storeId!)
        .eq("app_id", APP_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-app", storeId, APP_ID] });
      qc.invalidateQueries({ queryKey: ["store-apps", storeId] });
      toast.success("Uninstalled");
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["store-app-leads", storeId, APP_ID],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_app_leads")
        .select("id, phone, country_code, coupon_code, segment_label, marketing_opt_in, created_at")
        .eq("store_id", storeId!)
        .eq("app_id", APP_ID)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const totalWeight = useMemo(
    () => config.segments.reduce((s, x) => s + Math.max(0, Number(x.weight) || 0), 0),
    [config.segments]
  );

  const updateSegment = (i: number, patch: Partial<WheelSegment>) => {
    setConfig((c) => {
      const next = [...c.segments];
      next[i] = { ...next[i], ...patch };
      return { ...c, segments: next };
    });
  };
  const addSegment = () => {
    if (config.segments.length >= 8) return;
    setConfig((c) => ({
      ...c,
      segments: [...c.segments, { label: "New Prize", type: "coupon", code: "NEW", discount_type: "percentage", discount_value: 5, min_order: 0, weight: 10 }],
    }));
  };
  const removeSegment = (i: number) => {
    if (config.segments.length <= 2) { toast.error("Need at least 2 segments"); return; }
    setConfig((c) => ({ ...c, segments: c.segments.filter((_, x) => x !== i) }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const isInstalled = !!row;

  return (
    <AppConfigShell
      storeSlug={storeSlug}
      icon={<Disc3 className="h-4.5 w-4.5" />}
      accent="from-indigo-500 to-fuchsia-500"
      title={appMeta.name}
      subtitle={appMeta.tagline}
      enabled={enabled}
      onEnabledChange={(v) => {
        // Persist immediately — otherwise the toggle looks on but the app was
        // never installed (no store_apps row) until the user pressed Save.
        setEnabled(v);
        upsert.mutate({ enabled: v, config });
      }}
      onSave={() => upsert.mutate({ enabled, config })}
      saving={upsert.isPending}
      saveDisabled={(config.outcome_mode || "random") !== "fixed" && totalWeight <= 0}
      saveLabel={isInstalled ? "Save" : "Install"}
      statusBadge={<AppLiveBadge enabled={enabled} />}
    >
      {!enabled && (
        <div className="mx-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 md:mx-0">
          The wheel is not shown to shoppers until you toggle <strong>Enabled</strong> and click <strong>Save</strong>.
        </div>
      )}

      <div className="grid gap-3 md:gap-6 lg:grid-cols-3">
        <div className="space-y-3 md:space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spin Outcome</CardTitle>
              <CardDescription>Decide whether the prize is random or always the same slice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { v: "random", t: "Random (weighted)", d: "Each slice wins based on its weight below." },
                  { v: "fixed", t: "Always one slice", d: "Every shopper lands on the slice you pick." },
                ] as const).map((o) => {
                  const active = (config.outcome_mode || "random") === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, outcome_mode: o.v }))}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{o.t}</span>
                        {active && <Badge className="text-[10px]">Active</Badge>}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{o.d}</p>
                    </button>
                  );
                })}
              </div>

              {(config.outcome_mode || "random") === "fixed" && (
                <div>
                  <Label className="text-xs">Winning slice</Label>
                  <Select
                    value={String(
                      Math.min(Math.max(0, Number(config.fixed_segment_index) || 0), Math.max(0, config.segments.length - 1)),
                    )}
                    onValueChange={(v) => setConfig((c) => ({ ...c, fixed_segment_index: Number(v) }))}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {config.segments.map((s, i) => (
                        <SelectItem key={i} value={String(i)}>
                          Slice {i + 1} — {s.label}
                          {s.type === "coupon" && s.code ? ` (${s.code})` : " (no prize)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Weights are ignored in this mode. The wheel still animates realistically before stopping here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wheel Segments</CardTitle>
              <CardDescription>2–8 slices. Higher weight = higher chance of landing there.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {config.segments.map((seg, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-[10px]">Slice {i + 1}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => removeSegment(i)} className="h-7 w-7">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                    <div className="col-span-2">
                      <Label className="text-xs">Label</Label>
                      <Input value={seg.label} onChange={(e) => updateSegment(i, { label: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select value={seg.type} onValueChange={(v: any) => updateSegment(i, { type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coupon">Coupon</SelectItem>
                          <SelectItem value="lose">No prize</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {seg.type === "coupon" && (
                      <>
                        <div>
                          <Label className="text-xs">Code</Label>
                          <Input value={seg.code ?? ""} onChange={(e) => updateSegment(i, { code: e.target.value.toUpperCase() })} />
                        </div>
                        <div>
                          <Label className="text-xs">Discount</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={seg.discount_value ?? 0}
                              onChange={(e) => updateSegment(i, { discount_value: Number(e.target.value) })}
                            />
                            <Select
                              value={seg.discount_type ?? "percentage"}
                              onValueChange={(v: any) => updateSegment(i, { discount_type: v })}
                            >
                              <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">%</SelectItem>
                                <SelectItem value="flat">₹</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Min ₹</Label>
                          <Input
                            type="number"
                            value={seg.min_order ?? 0}
                            onChange={(e) => updateSegment(i, { min_order: Number(e.target.value) })}
                          />
                        </div>
                      </>
                    )}
                    <div className={seg.type === "coupon" ? "" : "col-span-4"}>
                      <Label className="text-xs">Weight</Label>
                      <Input
                        type="number"
                        value={seg.weight}
                        onChange={(e) => updateSegment(i, { weight: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addSegment} disabled={config.segments.length >= 8} className="w-full gap-1">
                <Plus className="h-4 w-4" /> Add slice
              </Button>
              <p className="text-[11px] text-muted-foreground">Total weight: {totalWeight}. Each slice's win probability = weight ÷ total.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wheel Design</CardTitle>
              <CardDescription>Pick a look — the wheel adopts your storefront colors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {(["classic", "neon", "gold", "candy"] as WheelStyle[]).map((s) => {
                  const active = (config.wheel_style || "classic") === s;
                  const swatch: Record<WheelStyle, string> = {
                    classic: `linear-gradient(135deg, ${previewPrimary}, ${previewAccent})`,
                    neon: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
                    gold: "linear-gradient(135deg, #f6c453, #7a4f0d)",
                    candy: "linear-gradient(135deg, #ff85a2, #ffbe0b, #4cc9f0)",
                  };
                  const labels: Record<WheelStyle, string> = {
                    classic: "Classic",
                    neon: "Neon",
                    gold: "Gold",
                    candy: "Candy",
                  };
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setConfig((c) => ({ ...c, wheel_style: s })); setPreviewKey((k) => k + 1); }}
                      className={`group relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${
                        active ? "border-primary shadow-lg" : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <div
                        className="mb-2 h-16 w-full rounded-lg"
                        style={{ background: swatch[s] }}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{labels[s]}</span>
                        {active && <Badge className="text-[10px]">Active</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-semibold">Tick sound & celebration</Label>
                  <p className="text-[11px] text-muted-foreground">Play mechanical ticks while spinning and a win chime on prize.</p>
                </div>
                <Switch
                  checked={config.sound_enabled !== false}
                  onCheckedChange={(v) => setConfig((c) => ({ ...c, sound_enabled: v }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display Rules & Copy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Trigger after (seconds)</Label>
                  <Input
                    type="number"
                    min={3}
                    value={Math.round((config.trigger_delay_ms || 11000) / 1000)}
                    onChange={(e) => setConfig((c) => ({ ...c, trigger_delay_ms: Math.max(3, Number(e.target.value)) * 1000 }))}
                    disabled={config.time_trigger_enabled === false}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Time on page before the wheel appears.</p>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch
                    checked={config.show_on_mobile}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, show_on_mobile: v }))}
                  />
                  <Label className="text-xs">Show on mobile</Label>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch
                    checked={config.show_on_desktop}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, show_on_desktop: v }))}
                  />
                  <Label className="text-xs">Show on desktop</Label>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Timer popup</Label>
                    <p className="text-[11px] text-muted-foreground">Show the wheel automatically after the delay above.</p>
                  </div>
                  <Switch
                    checked={config.time_trigger_enabled !== false}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, time_trigger_enabled: v }))}
                  />
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <Label className="text-sm font-semibold">Exit-intent popup</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Trigger the wheel when the shopper tries to leave.
                    </p>
                  </div>
                  <Switch
                    checked={config.exit_intent_enabled !== false}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, exit_intent_enabled: v }))}
                  />
                </div>
                <div className="border-t pt-3">
                  <Label className="text-xs">Exit-intent listens on</Label>
                  <Select
                    value={config.exit_intent_scope || "all"}
                    onValueChange={(v: any) => setConfig((c) => ({ ...c, exit_intent_scope: v }))}
                    disabled={config.exit_intent_enabled === false}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All storefront pages</SelectItem>
                      <SelectItem value="product">Only product pages</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Wheel heading</Label>
                  <Input value={config.heading} onChange={(e) => setConfig((c) => ({ ...c, heading: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Sub-heading</Label>
                  <Input value={config.subheading} onChange={(e) => setConfig((c) => ({ ...c, subheading: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Spin button label</Label>
                  <Input value={config.button_label} onChange={(e) => setConfig((c) => ({ ...c, button_label: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Lead form heading</Label>
                  <Input value={config.lead_heading} onChange={(e) => setConfig((c) => ({ ...c, lead_heading: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Consent checkbox label</Label>
                  <Input value={config.marketing_consent_label} onChange={(e) => setConfig((c) => ({ ...c, marketing_consent_label: e.target.value }))} />
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-semibold">Verify mobile with WhatsApp OTP</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Shopper gets a 6-digit code on WhatsApp before the coupon unlocks. Blocks fake numbers and
                      guarantees every lead is reachable.
                    </p>
                  </div>
                  <Switch
                    checked={config.require_otp === true}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, require_otp: v }))}
                  />
                </div>
                {config.require_otp === true && (
                  <p className="mt-2 rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
                    Each OTP is charged as a WhatsApp authentication message from your wallet. Codes expire in 5
                    minutes, allow 5 attempts, and are rate-limited per number and device.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>



          <Card>
            <CardHeader>
              <CardTitle className="text-base">Captured leads ({leads?.length ?? 0})</CardTitle>
              <CardDescription>Last 100 phone numbers collected via the wheel.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Coupon</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead>Opt-in</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(leads ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">No leads yet</TableCell></TableRow>
                    ) : (leads ?? []).map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.country_code} {l.phone}</TableCell>
                        <TableCell><Badge variant="outline">{l.coupon_code ?? "—"}</Badge></TableCell>
                        <TableCell className="text-xs">{l.segment_label ?? "—"}</TableCell>
                        <TableCell>{l.marketing_opt_in ? "✓" : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {isInstalled && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Uninstall spin wheel? Leads are kept.")) uninstall.mutate(); }}
            >
              Uninstall app
            </Button>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Live preview</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setPreviewKey((k) => k + 1)}>Replay</Button>
            </CardHeader>
            <CardContent>
              <div className="relative min-h-[520px] rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden">
                <PreviewMount
                  key={previewKey}
                  storeName={store?.name || "Your store"}
                  config={{ ...config, trigger_delay_ms: 100 }}
                  primary={previewPrimary}
                  accent={previewAccent}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Preview ignores session dedup so you can spin repeatedly.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppConfigShell>
  );
}

function PreviewMount({ storeName, config, primary, accent }: { storeName: string; config: SpinWheelConfig; primary: string; accent: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { sessionStorage.removeItem("sf_spin_shown_preview"); } catch {}
    setReady(true);
  }, []);
  if (!ready) return null;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        ["--storefront-primary" as any]: primary,
        ["--storefront-accent" as any]: accent,
      }}
    >
      <SpinWheelApp
        storeId="preview"
        storeName={storeName}
        primaryColor={primary}
        accentColor={accent}
        config={config}
        previewMode
      />
    </div>
  );
}
