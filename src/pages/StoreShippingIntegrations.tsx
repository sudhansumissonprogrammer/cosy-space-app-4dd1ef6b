/**
 * Shipping Integrations — merchant-facing config for Shiprocket, Delhivery, Ekart
 * plus pickup addresses. Sibling of StoreShipping.tsx (flat-rate config).
 */
import { useEffect, useState } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Trash2, MapPin, Truck, CheckCircle2 } from "lucide-react";

type Provider = "shiprocket" | "delhivery" | "ekart" | "bluedart";

const BLANK: Record<Provider, any> = {
  shiprocket: { provider: "shiprocket", is_enabled: true, sandbox: false, api_email: "", api_password: "" },
  delhivery:  { provider: "delhivery",  is_enabled: true, sandbox: false, api_key: "", client_id: "" },
  ekart:      { provider: "ekart",      is_enabled: true, sandbox: false, api_key: "", client_id: "" },
  bluedart:   { provider: "bluedart",   is_enabled: true, sandbox: false, client_id: "", api_key: "", api_email: "", api_secret: "" },
};

export default function StoreShippingIntegrations() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["ship-providers", storeId],
    enabled: !!storeId && !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_shipping_providers").select("*").eq("store_id", storeId!);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: pickups = [] } = useQuery({
    queryKey: ["pickup-addresses", storeId],
    enabled: !!storeId && !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_pickup_addresses").select("*").eq("store_id", storeId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shipping Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect Shiprocket, Delhivery, or Ekart to auto-create shipments and print labels.
        </p>
      </div>

      <PickupAddresses storeId={storeId!} pickups={pickups} />

      <Tabs defaultValue="shiprocket">
        <TabsList>
          <TabsTrigger value="shiprocket">Shiprocket</TabsTrigger>
          <TabsTrigger value="delhivery">Delhivery</TabsTrigger>
          <TabsTrigger value="ekart">Ekart</TabsTrigger>
          <TabsTrigger value="bluedart">Blue Dart</TabsTrigger>
        </TabsList>
        {(["shiprocket","delhivery","ekart","bluedart"] as Provider[]).map(p => (
          <TabsContent key={p} value={p}>
            <ProviderCard
              provider={p}
              storeId={storeId!}
              existing={providers.find((x: any) => x.provider === p)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["ship-providers", storeId] })}
              pickups={pickups}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ProviderCard({ provider, storeId, existing, onSaved, pickups }: any) {
  const [row, setRow] = useState<any>(existing ?? { ...BLANK[provider as Provider], store_id: storeId });
  useEffect(() => { setRow(existing ?? { ...BLANK[provider as Provider], store_id: storeId }); }, [existing, provider, storeId]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...row, store_id: storeId };
      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("store_shipping_providers").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("store_shipping_providers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(`${provider} saved`); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async () => {
      const args: any = { store_id: storeId };
      if (provider === "shiprocket") {
        Object.assign(args, { action: "rate", pickup_pincode: "110001", delivery_pincode: "400001", weight: 0.5, cod: 0 });
      } else if (provider === "delhivery") {
        Object.assign(args, { action: "serviceability", pincode: "110001" });
      } else if (provider === "bluedart") {
        const awb = (row.extra?.test_awb ?? "").trim();
        if (!awb) throw new Error("Enter a sample Blue Dart AWB below to test");
        Object.assign(args, { action: "test", awb });
      } else {
        Object.assign(args, { action: "serviceability", pickup_pincode: "110001", delivery_pincode: "400001", weight_grams: 500, cod: false });
      }
      const { data, error } = await supabase.functions.invoke(provider, { body: args });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => toast.success("Credentials work! ✓"),
    onError: (e: any) => toast.error("Test failed: " + e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" /> {provider[0].toUpperCase() + provider.slice(1)}
          {existing && <span className="text-xs text-green-600 flex items-center gap-1 ml-2"><CheckCircle2 className="h-4 w-4"/> configured</span>}
        </CardTitle>
        <CardDescription>{DESCS[provider as Provider]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Enabled</Label>
          <Switch checked={!!row.is_enabled} onCheckedChange={(v) => setRow({ ...row, is_enabled: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Sandbox / test mode</Label>
          <Switch checked={!!row.sandbox} onCheckedChange={(v) => setRow({ ...row, sandbox: v })} />
        </div>

        {provider === "shiprocket" && (
          <>
            <Field label="Shiprocket Email" value={row.api_email} onChange={(v: string) => setRow({ ...row, api_email: v })} />
            <Field label="Shiprocket Password" type="password" value={row.api_password} onChange={(v: string) => setRow({ ...row, api_password: v })} />
            <p className="text-xs text-muted-foreground">Stored securely. Used once to mint a 10-day auth token that we cache.</p>
          </>
        )}
        {provider === "delhivery" && (
          <>
            <Field label="Delhivery API Token" value={row.api_key} onChange={(v: string) => setRow({ ...row, api_key: v })} placeholder="From Delhivery One → Settings → API" />
            <Field label="Client Name (optional)" value={row.client_id} onChange={(v: string) => setRow({ ...row, client_id: v })} />
          </>
        )}
        {provider === "bluedart" && (
          <>
            <Field label="Blue Dart Login ID" value={row.client_id} onChange={(v: string) => setRow({ ...row, client_id: v })} placeholder="Customer / login ID from Blue Dart" />
            <Field label="Blue Dart Licence Key" type="password" value={row.api_key} onChange={(v: string) => setRow({ ...row, api_key: v })} placeholder="Tracking licence key" />
            <Field label="API Gateway ClientID (optional)" value={row.api_email} onChange={(v: string) => setRow({ ...row, api_email: v })} />
            <Field label="API Gateway Client Secret (optional)" type="password" value={row.api_secret} onChange={(v: string) => setRow({ ...row, api_secret: v })} />
            <Field label="Sample AWB (for testing only)" value={row.extra?.test_awb ?? ""} onChange={(v: string) => setRow({ ...row, extra: { ...(row.extra ?? {}), test_awb: v } })} placeholder="e.g. 12345678901" />
            <p className="text-xs text-muted-foreground">
              Without these keys Blue Dart AWBs cannot be fetched — Blue Dart blocks automated lookups on its public tracking page.
            </p>
          </>
        )}
        {provider === "ekart" && (
          <>
            <Field label="Ekart Merchant Code" value={row.client_id} onChange={(v: string) => setRow({ ...row, client_id: v })} />
            <Field label="Ekart Auth Key" type="password" value={row.api_key} onChange={(v: string) => setRow({ ...row, api_key: v })} />
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
          </Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !existing}>
            {test.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Test credentials
          </Button>
        </div>

        {provider === "shiprocket" && existing && pickups.length > 0 && (
          <ShiprocketPickupRegister storeId={storeId} pickups={pickups} />
        )}
      </CardContent>
    </Card>
  );
}

function ShiprocketPickupRegister({ storeId, pickups }: any) {
  const register = useMutation({
    mutationFn: async (pickupId: string) => {
      const { data, error } = await supabase.functions.invoke("shiprocket", {
        body: { action: "register_pickup", store_id: storeId, pickup_id: pickupId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => toast.success("Registered pickup with Shiprocket"),
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="rounded-md border p-3 space-y-2 mt-4">
      <div className="text-sm font-medium">Register pickup with Shiprocket</div>
      {pickups.map((p: any) => (
        <div key={p.id} className="flex items-center justify-between text-sm">
          <div>
            {p.nickname} — {p.city}
            {p.shiprocket_pickup_name && <span className="ml-2 text-green-600 text-xs">✓ {p.shiprocket_pickup_name}</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => register.mutate(p.id)} disabled={register.isPending}>
            {p.shiprocket_pickup_name ? "Re-register" : "Register"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function PickupAddresses({ storeId, pickups }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    nickname: "", contact_name: "", phone: "", email: "",
    address_line1: "", address_line2: "", city: "", state: "", pincode: "",
    is_default: pickups.length === 0,
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("store_pickup_addresses")
        .insert({ ...form, store_id: storeId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pickup address added");
      qc.invalidateQueries({ queryKey: ["pickup-addresses", storeId] });
      setForm({ nickname: "", contact_name: "", phone: "", email: "", address_line1: "", address_line2: "", city: "", state: "", pincode: "", is_default: false });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("store_pickup_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pickup-addresses", storeId] }),
  });
  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("store_pickup_addresses").update({ is_default: false }).eq("store_id", storeId);
      const { error } = await (supabase as any).from("store_pickup_addresses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pickup-addresses", storeId] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Pickup Addresses</CardTitle>
        <CardDescription>Warehouse address that couriers pick up from. Required for shipment creation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pickups.map((p: any) => (
          <div key={p.id} className="rounded border p-3 flex items-start justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">{p.nickname} {p.is_default && <span className="text-xs text-green-600 ml-1">DEFAULT</span>}</div>
              <div className="text-muted-foreground">{p.contact_name} • {p.phone}</div>
              <div className="text-muted-foreground">{p.address_line1}, {p.city}, {p.state} - {p.pincode}</div>
            </div>
            <div className="flex gap-2">
              {!p.is_default && <Button size="sm" variant="outline" onClick={() => setDefault.mutate(p.id)}>Make default</Button>}
              <Button size="sm" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}

        <div className="grid gap-3 sm:grid-cols-2 pt-3 border-t">
          <Field label="Nickname *" value={form.nickname} onChange={(v: string) => setForm({ ...form, nickname: v })} placeholder="Main warehouse" />
          <Field label="Contact name *" value={form.contact_name} onChange={(v: string) => setForm({ ...form, contact_name: v })} />
          <Field label="Phone *" value={form.phone} onChange={(v: string) => setForm({ ...form, phone: v })} />
          <Field label="Email" value={form.email} onChange={(v: string) => setForm({ ...form, email: v })} />
          <Field label="Address line 1 *" value={form.address_line1} onChange={(v: string) => setForm({ ...form, address_line1: v })} />
          <Field label="Address line 2" value={form.address_line2} onChange={(v: string) => setForm({ ...form, address_line2: v })} />
          <Field label="City *" value={form.city} onChange={(v: string) => setForm({ ...form, city: v })} />
          <Field label="State *" value={form.state} onChange={(v: string) => setForm({ ...form, state: v })} />
          <Field label="Pincode *" value={form.pincode} onChange={(v: string) => setForm({ ...form, pincode: v })} />
        </div>
        <Button onClick={() => add.mutate()} disabled={add.isPending || !form.nickname || !form.contact_name || !form.phone || !form.address_line1 || !form.pincode}>
          {add.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add pickup address
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

const DESCS: Record<Provider, string> = {
  shiprocket: "Aggregator — one integration for 20+ couriers including Bluedart, DTDC, India Post. Best for small sellers. Sign up at shiprocket.in and paste your login here.",
  delhivery:  "Direct integration — best rates for high-volume sellers. Get an API token from Delhivery One dashboard → Settings → API.",
  bluedart:   "Direct tracking integration — Blue Dart's public tracking page is captcha-protected, so AWB tracking needs your own Login ID + Licence Key (Blue Dart eTools / your account manager). Optional API-gateway keys use the newer JWT endpoint.",
  ekart:      "Direct integration — Flipkart's courier arm. Get merchant code + auth key from your Ekart account manager (SME onboarding available at ekartlogistics.com).",
};
