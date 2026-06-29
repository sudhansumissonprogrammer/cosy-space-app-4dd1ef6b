import { useEffect, useState } from "react";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ShoppingCart, CheckCircle2, Truck, PackageCheck, Star, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function StoreWhatsAppSimple() {
  useDocumentTitle("WhatsApp Marketing");
  const { storeId, store } = useDashboardStore();
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_store_platform_marketing" as any, { _store_id: storeId });
      if (!error) setEnabled(Boolean(data ?? true));
      setLoading(false);
    })();
  }, [storeId]);

  const toggle = async (value: boolean) => {
    if (!storeId) return;
    setSaving(true);
    const prev = enabled;
    setEnabled(value);
    const { error } = await supabase.rpc("set_store_platform_marketing" as any, {
      _store_id: storeId,
      _enabled: value,
    });
    setSaving(false);
    if (error) {
      setEnabled(prev);
      toast.error(error.message || "Failed to update");
      return;
    }
    toast.success(value ? "ShopBanao marketing enabled" : "ShopBanao marketing disabled");
  };

  // Only these three automations are live today. Don't list features we don't
  // actually fire — it sets wrong expectations with merchants.
  const automations = [
    { icon: CheckCircle2, label: "Order confirmation", desc: "Instant WhatsApp confirmation the moment an order is placed." },
    { icon: Truck, label: "Shipping update", desc: "Tracking link goes out automatically when you mark the order shipped with a tracking number." },
    { icon: ShoppingCart, label: "Abandoned cart recovery", desc: "Customers who left items in their cart get one friendly reminder." },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-green-600" />
          WhatsApp Marketing
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Powered by ShopBanao&apos;s verified WhatsApp number — no setup required.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Enable ShopBanao Marketing</CardTitle>
            <CardDescription>
              When ON, your customers automatically receive WhatsApp messages sent from the ShopBanao platform number on behalf of <strong>{store?.name || "your store"}</strong>.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[11px] text-muted-foreground">Saving…</span>}
            <Switch checked={enabled} disabled={loading || saving} onCheckedChange={toggle} aria-label="Enable WhatsApp marketing" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Active" : "Paused"}</Badge>
            <Label className="text-muted-foreground">Sender: ShopBanao verified WhatsApp</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What gets automated</CardTitle>
          <CardDescription>All managed by ShopBanao — no templates or credentials to configure.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {automations.map((a) => (
              <li key={a.label} className="flex items-start gap-3 py-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <Badge variant={enabled ? "outline" : "secondary"} className="text-[10px]">
                  {enabled ? "On" : "Paused"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced features</CardTitle>
          <CardDescription>Coming soon — your own WhatsApp number, live chat, broadcast builder, AI replies.</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">Phase 2 · Coming Soon</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
