import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Cfg = {
  whatsapp_mode: string;
  wa_enabled: boolean;
  wa_phone_number_id: string | null;
  wa_business_phone: string | null;
  wa_waba_id: string | null;
  wa_default_lang: string;
  wa_min_cart_age_minutes: number;
  wa_max_cart_age_hours: number;
  wa_daily_cap_per_phone: number;
  wa_tier_limit?: number;
  wa_access_token_present: boolean;
  wa_app_secret_present: boolean;
  wa_queue_batch_size?: number;
  wa_pilot_mode?: boolean;
  wa_pilot_cohort?: string[];
};

export function AdminPlatformTab() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [secretInput, setSecretInput] = useState("");

  // test send
  const [testPhone, setTestPhone] = useState("");
  const [testTemplate, setTestTemplate] = useState("abandoned_cart_v1");
  const [testVars, setTestVars] = useState("Customer,Store,₹999,https://shopbanao.in");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_get_platform_wa_config" as any);
    if (error) toast.error(error.message);
    else setCfg(data as Cfg);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (patch: Partial<Cfg> & { wa_access_token?: string; wa_app_secret?: string }) => async () => {
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_platform_wa_config" as any, { _patch: patch });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setTokenInput(""); setSecretInput("");
    load();
  };

  const sendTest = async () => {
    if (!testPhone || !testTemplate) { toast.error("Phone and template required"); return; }
    setTesting(true);
    const params = testVars.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.functions.invoke("wa-platform-send", {
      body: { mode: "test", recipient_phone: testPhone, template_name: testTemplate, template_params: params },
    });
    setTesting(false);
    if (error) toast.error(error.message);
    else toast.success("Test message dispatched");
  };

  if (loading || !cfg) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform mode</CardTitle>
          <CardDescription>Controls whether stores use the shared ShopBanao number, their own, or both.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Select value={cfg.whatsapp_mode} onValueChange={(v) => setCfg({ ...cfg, whatsapp_mode: v })}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="platform_only">Platform only (Phase 1)</SelectItem>
                <SelectItem value="dual_mode">Dual mode (Phase 2)</SelectItem>
                <SelectItem value="merchant_only">Merchant only</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" disabled={saving} onClick={update({ whatsapp_mode: cfg.whatsapp_mode })}>Save mode</Button>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={cfg.wa_enabled} onCheckedChange={(v) => setCfg({ ...cfg, wa_enabled: v })} />
            <Label className="text-sm">Global kill switch (wa_enabled)</Label>
            <Button size="sm" variant="outline" disabled={saving} onClick={update({ wa_enabled: cfg.wa_enabled })}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta WhatsApp Cloud credentials</CardTitle>
          <CardDescription>Single platform-wide account. Stored encrypted at rest.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Phone Number ID</Label>
            <Input value={cfg.wa_phone_number_id ?? ""} onChange={(e) => setCfg({ ...cfg, wa_phone_number_id: e.target.value })} />
          </div>
          <div>
            <Label>Business Phone (display)</Label>
            <Input value={cfg.wa_business_phone ?? ""} onChange={(e) => setCfg({ ...cfg, wa_business_phone: e.target.value })} />
          </div>
          <div>
            <Label>WABA ID</Label>
            <Input value={cfg.wa_waba_id ?? ""} onChange={(e) => setCfg({ ...cfg, wa_waba_id: e.target.value })} />
          </div>
          <div>
            <Label>Default language</Label>
            <Input value={cfg.wa_default_lang} onChange={(e) => setCfg({ ...cfg, wa_default_lang: e.target.value })} />
          </div>
          <div>
            <Label>Access Token {cfg.wa_access_token_present && <Badge variant="secondary" className="ml-2">saved</Badge>}</Label>
            <Input type="password" placeholder="leave blank to keep existing" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
          </div>
          <div>
            <Label>App Secret {cfg.wa_app_secret_present && <Badge variant="secondary" className="ml-2">saved</Badge>}</Label>
            <Input type="password" placeholder="leave blank to keep existing" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button disabled={saving} onClick={update({
              wa_phone_number_id: cfg.wa_phone_number_id ?? undefined,
              wa_business_phone: cfg.wa_business_phone ?? undefined,
              wa_waba_id: cfg.wa_waba_id ?? undefined,
              wa_default_lang: cfg.wa_default_lang,
              wa_access_token: tokenInput || undefined,
              wa_app_secret: secretInput || undefined,
            } as any)}>Save credentials</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cart recovery window</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Min age (minutes)</Label>
            <Input type="number" value={cfg.wa_min_cart_age_minutes} onChange={(e) => setCfg({ ...cfg, wa_min_cart_age_minutes: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Max age (hours)</Label>
            <Input type="number" value={cfg.wa_max_cart_age_hours} onChange={(e) => setCfg({ ...cfg, wa_max_cart_age_hours: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Daily cap per phone</Label>
            <Input type="number" value={cfg.wa_daily_cap_per_phone} onChange={(e) => setCfg({ ...cfg, wa_daily_cap_per_phone: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-3">
            <Button disabled={saving} onClick={update({
              wa_min_cart_age_minutes: cfg.wa_min_cart_age_minutes,
              wa_max_cart_age_hours: cfg.wa_max_cart_age_hours,
              wa_daily_cap_per_phone: cfg.wa_daily_cap_per_phone,
            })}>Save window</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queue & pilot rollout</CardTitle>
          <CardDescription>Limit sends to a small cohort while you validate, then disable pilot mode to enable everyone.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Queue batch size (per worker run)</Label>
            <Input type="number" value={cfg.wa_queue_batch_size ?? 50} onChange={(e) => setCfg({ ...cfg, wa_queue_batch_size: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Daily tier limit (sender)</Label>
            <Input
              type="number"
              value={cfg.wa_tier_limit ?? 250}
              onChange={(e) => setCfg({ ...cfg, wa_tier_limit: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Hard cap on outgoing platform sends per 24h. New WABA = 250. Increase as Meta upgrades your tier (1k → 10k → 100k → unlimited).
            </p>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={!!cfg.wa_pilot_mode} onCheckedChange={(v) => setCfg({ ...cfg, wa_pilot_mode: v })} />
            <Label className="text-sm">Pilot mode (only allow cohort stores)</Label>
          </div>
          <div className="sm:col-span-2">
            <Label>Pilot store IDs (comma-separated UUIDs)</Label>
            <Input value={(cfg.wa_pilot_cohort || []).join(",")} onChange={(e) => setCfg({ ...cfg, wa_pilot_cohort: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="store-uuid-1, store-uuid-2" />
          </div>
          <div className="sm:col-span-2">
            <Button disabled={saving} onClick={update({
              wa_queue_batch_size: cfg.wa_queue_batch_size ?? 50,
              wa_tier_limit: cfg.wa_tier_limit ?? 250,
              wa_pilot_mode: !!cfg.wa_pilot_mode,
              wa_pilot_cohort: cfg.wa_pilot_cohort || [],
            } as any)}>Save pilot config</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test send</CardTitle>
          <CardDescription>Sends a single message via the platform number to verify configuration.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Phone (E.164, no +)</Label>
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="919876543210" />
          </div>
          <div>
            <Label>Template name</Label>
            <Input value={testTemplate} onChange={(e) => setTestTemplate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Template params (comma-separated)</Label>
            <Input value={testVars} onChange={(e) => setTestVars(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button disabled={testing} onClick={sendTest}>{testing ? "Sending…" : "Send test"}</Button>
          </div>
        </CardContent>
      </Card>

      <PlatformHealthCard />
      <PlatformCostCard />

    </div>
  );
}

function PlatformHealthCard() {
  const [snap, setSnap] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.rpc("admin_wa_health_snapshot" as any);
    setSnap(Array.isArray(data) ? data[0] : data);
  };
  useEffect(() => { load(); }, []);

  const runHealth = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("wa-health-check");
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Health snapshot updated"); load(); }
  };

  const syncTemplates = async () => {
    setBusy(true);
    const { error, data } = await supabase.functions.invoke("wa-template-sync");
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(`Synced ${(data as any)?.updated ?? 0} templates from Meta`);
  };

  const qualityColor =
    snap?.quality_rating === "GREEN" ? "text-emerald-600" :
    snap?.quality_rating === "YELLOW" ? "text-amber-600" :
    snap?.quality_rating === "RED" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform health</CardTitle>
        <CardDescription>Refreshed automatically every 6 hours. Sync templates pulls Meta approval status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {snap ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Quality" value={snap.quality_rating || "—"} valueClass={qualityColor} />
            <Stat label="Tier" value={snap.messaging_limit_tier || "—"} />
            <Stat label="Name status" value={snap.name_status || "—"} />
            <Stat label="Token" value={snap.token_valid ? "Valid" : "Invalid"} valueClass={snap.token_valid ? "text-emerald-600" : "text-destructive"} />
            <p className="col-span-2 sm:col-span-4 text-[11px] text-muted-foreground">Checked {snap.checked_at ? new Date(snap.checked_at).toLocaleString() : "—"}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No health snapshot yet — run one now.</p>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={runHealth}>Run health check</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={syncTemplates}>Sync templates from Meta</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformCostCard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    supabase.rpc("get_wa_cost_summary" as any).then(({ data }) => setData(data));
  }, []);
  if (!data) return null;
  const fmt = (n: number) => `₹${Number(n || 0).toFixed(2)}`;
  const cats = (data.by_category_mtd || {}) as Record<string, { conversations: number; cost: number }>;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta conversation cost</CardTitle>
        <CardDescription>India rates applied per conversation (24h window). Service replies are free.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Stat label="Today" value={`${fmt(data.today?.cost)} · ${data.today?.conversations ?? 0}`} />
          <Stat label="Last 7 days" value={`${fmt(data.last_7d?.cost)} · ${data.last_7d?.conversations ?? 0}`} />
          <Stat label="Month to date" value={`${fmt(data.mtd?.cost)} · ${data.mtd?.conversations ?? 0}`} />
        </div>
        {Object.keys(cats).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {Object.entries(cats).map(([cat, v]) => (
              <div key={cat} className="rounded border bg-muted/20 px-2 py-1">
                <div className="uppercase text-[10px] text-muted-foreground">{cat}</div>
                <div className="font-medium">{fmt(v.cost)} · {v.conversations}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}
