/**
 * ShipOrderPanel — dropped onto an order detail page.
 * Merchant picks provider + package dims + (for Shiprocket) courier, and
 * we call the appropriate edge function to create the shipment.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Truck, ExternalLink } from "lucide-react";
import { aggregatorTrackingUrl } from "@/lib/shipping/courierRegistry";

type Order = {
  id: string; store_id: string; pincode?: string | null;
  payment_method?: string | null; total?: number | null;
};

export default function ShipOrderPanel({ order }: { order: Order }) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<"shiprocket" | "delhivery" | "ekart">("shiprocket");
  const [dims, setDims] = useState({ length_cm: 10, breadth_cm: 10, height_cm: 10, weight_kg: 0.5 });
  const [courierId, setCourierId] = useState<string>("");

  const { data: shipments = [] } = useQuery({
    queryKey: ["order-shipments", order.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_shipments").select("*")
        .eq("order_id", order.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["ship-providers", order.store_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_shipping_providers").select("provider,is_enabled")
        .eq("store_id", order.store_id).eq("is_enabled", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: pickup } = useQuery({
    queryKey: ["pickup-default", order.store_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_pickup_addresses").select("*")
        .eq("store_id", order.store_id).eq("is_default", true).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: rates, refetch: fetchRates, isFetching: ratesLoading } = useQuery({
    queryKey: ["ship-rates", provider, order.id, dims.weight_kg],
    enabled: false,
    queryFn: async () => {
      if (!pickup) throw new Error("Add a default pickup address first");
      if (!order.pincode) throw new Error("Order has no delivery pincode");
      const body: any = { store_id: order.store_id };
      if (provider === "shiprocket") {
        Object.assign(body, {
          action: "rate",
          pickup_pincode: pickup.pincode, delivery_pincode: order.pincode,
          weight: dims.weight_kg, cod: order.payment_method === "cod" ? 1 : 0,
        });
      } else if (provider === "delhivery") {
        Object.assign(body, {
          action: "rate",
          pickup_pincode: pickup.pincode, delivery_pincode: order.pincode,
          weight_grams: Math.round(dims.weight_kg * 1000),
          cod: order.payment_method === "cod",
        });
      } else {
        Object.assign(body, {
          action: "serviceability",
          pickup_pincode: pickup.pincode, delivery_pincode: order.pincode,
          weight_grams: Math.round(dims.weight_kg * 1000),
          cod: order.payment_method === "cod",
        });
      }
      const { data, error } = await supabase.functions.invoke(provider, { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const body: any = {
        action: "create",
        store_id: order.store_id,
        order_id: order.id,
        length_cm: dims.length_cm, breadth_cm: dims.breadth_cm, height_cm: dims.height_cm,
      };
      if (provider === "shiprocket") {
        body.weight_kg = dims.weight_kg;
        if (courierId) body.courier_id = Number(courierId);
      } else {
        body.weight_grams = Math.round(dims.weight_kg * 1000);
      }
      const { data, error } = await supabase.functions.invoke(provider, { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Shipment created");
      qc.invalidateQueries({ queryKey: ["order-shipments", order.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Shipping</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {shipments.length > 0 && (
          <div className="space-y-2">
            {shipments.map((s: any) => (
              <div key={s.id} className="rounded border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">{s.provider} · {s.courier_name ?? "—"}</span>
                  <span className="text-xs uppercase text-muted-foreground">{s.status}</span>
                </div>
                {s.awb && <div>AWB: <code className="text-xs">{s.awb}</code></div>}
                <div className="flex gap-3">
                  {s.awb && <a href={aggregatorTrackingUrl(s.awb)} target="_blank" rel="noreferrer" className="text-primary text-xs flex items-center gap-1">Track <ExternalLink className="h-3 w-3" /></a>}
                  {s.label_url && <a href={s.label_url} target="_blank" rel="noreferrer" className="text-primary text-xs flex items-center gap-1">Label <ExternalLink className="h-3 w-3" /></a>}
                </div>
                {s.last_error && <div className="text-destructive text-xs">{s.last_error}</div>}
              </div>
            ))}
          </div>
        )}

        {providers.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Configure a shipping provider in <a href={`/dashboard/stores/${order.store_id}/shipping-integrations`} className="text-primary underline">Shipping Integrations</a> first.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {providers.map((p: any) => <SelectItem key={p.provider} value={p.provider}>{p.provider}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Weight (kg)" value={dims.weight_kg} onChange={(v: number) => setDims({ ...dims, weight_kg: v })} step="0.1" />
              <NumField label="Length (cm)" value={dims.length_cm} onChange={(v: number) => setDims({ ...dims, length_cm: v })} />
              <NumField label="Breadth (cm)" value={dims.breadth_cm} onChange={(v: number) => setDims({ ...dims, breadth_cm: v })} />
              <NumField label="Height (cm)" value={dims.height_cm} onChange={(v: number) => setDims({ ...dims, height_cm: v })} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchRates()} disabled={ratesLoading}>
                {ratesLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Get rates
              </Button>
            </div>

            {provider === "shiprocket" && (rates as any)?.couriers && (
              <div className="space-y-1 max-h-56 overflow-auto rounded border p-2">
                {(rates as any).couriers.slice(0, 8).map((c: any) => (
                  <label key={c.courier_id} className={`flex justify-between items-center text-sm p-2 rounded cursor-pointer ${String(c.courier_id) === courierId ? "bg-primary/10" : "hover:bg-muted"}`}>
                    <input type="radio" name="courier" value={c.courier_id} checked={String(c.courier_id) === courierId} onChange={() => setCourierId(String(c.courier_id))} className="hidden" />
                    <span>{c.name} <span className="text-xs text-muted-foreground">· {c.etd}</span></span>
                    <span className="font-medium">₹{c.rate}</span>
                  </label>
                ))}
              </div>
            )}

            <Button onClick={() => create.mutate()} disabled={create.isPending || (provider === "shiprocket" && !courierId)}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create shipment
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onChange, step = "1" }: any) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
