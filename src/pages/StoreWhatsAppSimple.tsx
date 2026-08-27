import { useEffect, useState } from "react";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ShoppingCart, CheckCircle2, Truck, Inbox, Zap, ShieldCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StoreInbox } from "@/components/whatsapp/StoreInbox";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type ToggleKey = "master" | "order_confirmation" | "cod_confirmation" | "order_shipped" | "abandoned_cart";
type Toggles = Record<ToggleKey, boolean>;

const DEFAULTS: Toggles = {
  master: false,
  order_confirmation: false,
  cod_confirmation: false,
  order_shipped: false,
  abandoned_cart: false,
};

export default function StoreWhatsAppSimple() {
  useDocumentTitle("WhatsApp Marketing");
  const { storeId, store } = useDashboardStore();
  const [toggles, setToggles] = useState<Toggles>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ToggleKey | null>(null);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_store_wa_toggles" as any, { _store_id: storeId });
      if (!error && data) {
        const d = data as any;
        setToggles({
          master: !!d.master,
          order_confirmation: !!d.order_confirmation,
          cod_confirmation: !!d.cod_confirmation,
          order_shipped: !!d.order_shipped,
          abandoned_cart: !!d.abandoned_cart,
        });
      }
      setLoading(false);
    })();
  }, [storeId]);

  const setToggle = async (key: ToggleKey, value: boolean) => {
    if (!storeId) return;
    const prev = toggles[key];
    setToggles((t) => ({ ...t, [key]: value }));
    setSaving(key);
    const { error } = await supabase.rpc("set_store_wa_toggle" as any, {
      _store_id: storeId,
      _key: key,
      _enabled: value,
    });
    setSaving(null);
    if (error) {
      setToggles((t) => ({ ...t, [key]: prev }));
      toast.error(error.message || "Failed to update");
      return;
    }
    toast.success("Saved");
  };

  const master = toggles.master;
  const automations: { key: ToggleKey; icon: any; label: string; desc: string }[] = [
    { key: "order_confirmation", icon: CheckCircle2, label: "Order confirmation", desc: "Instant WhatsApp confirmation the moment an order is placed." },
    { key: "cod_confirmation", icon: ShieldCheck, label: "COD order confirmation", desc: "Full Cash-on-Delivery orders get a WhatsApp with ✅ Confirm Order / ✏️ Edit Address buttons, plus one reminder after 4 hours. Partly-prepaid orders are never messaged." },
    { key: "order_shipped", icon: Truck, label: "Shipping update", desc: "Tracking link goes out automatically when you mark the order shipped with a tracking number." },
    { key: "abandoned_cart", icon: ShoppingCart, label: "Abandoned cart recovery", desc: "Customers who left items in their cart get one friendly reminder." },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-green-600" />
          WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Powered by ShopBanao&apos;s verified WhatsApp number — no setup required.
        </p>
      </div>

      <Tabs defaultValue="inbox" className="space-y-5">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="h-4 w-4" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-1.5">
            <Zap className="h-4 w-4" /> Automations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="m-0">
          <StoreInbox storeId={storeId} />
        </TabsContent>

        <TabsContent value="automations" className="m-0 space-y-6 max-w-3xl">
      <Card>

        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Enable ShopBanao Marketing</CardTitle>
            <CardDescription>
              Master switch for <strong>{store?.name || "your store"}</strong>. When OFF, no WhatsApp messages are sent regardless of the per-event toggles below.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {saving === "master" && <span className="text-[11px] text-muted-foreground">Saving…</span>}
            <Switch
              checked={master}
              disabled={loading || saving !== null}
              onCheckedChange={(v) => setToggle("master", v)}
              aria-label="Enable WhatsApp marketing"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={master ? "default" : "secondary"}>{master ? "Active" : "Off"}</Badge>
            <Label className="text-muted-foreground">Sender: ShopBanao verified WhatsApp</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automations</CardTitle>
          <CardDescription>Turn on each automation you want ShopBanao to send on your behalf. All default to OFF.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {automations.map((a) => {
              const on = toggles[a.key];
              const effectiveOn = on && master;
              return (
                <li key={a.key} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                    <a.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                    {on && !master && (
                      <p className="text-[11px] text-amber-600 mt-1">Master switch is OFF — this won&apos;t send until you enable it above.</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Switch
                      checked={on}
                      disabled={loading || saving !== null}
                      onCheckedChange={(v) => setToggle(a.key, v)}
                      aria-label={a.label}
                    />
                    <Badge variant={effectiveOn ? "outline" : "secondary"} className="text-[10px]">
                      {saving === a.key ? "Saving…" : effectiveOn ? "On" : "Off"}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced features</CardTitle>
          <CardDescription>Coming soon — your own WhatsApp number, broadcast builder, AI replies.</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">Phase 2 · Coming Soon</Badge>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>

  );
}
