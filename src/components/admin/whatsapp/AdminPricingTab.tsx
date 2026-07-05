import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, IndianRupee } from "lucide-react";

type Row = {
  price_marketing: number;
  price_utility: number;
  price_authentication: number;
  price_service: number;
  updated_at: string;
};

export function AdminPricingTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["wa-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wa_pricing_config" as any).select("*").maybeSingle();
      if (error) throw error;
      return data as unknown as Row;
    },
  });

  const [form, setForm] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);

  if (isLoading || !form) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("wa_pricing_config" as any)
        .update({
          price_marketing: form.price_marketing,
          price_utility: form.price_utility,
          price_authentication: form.price_authentication,
          price_service: form.price_service,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);
      if (error) throw error;
      toast({ title: "Pricing updated" });
      qc.invalidateQueries({ queryKey: ["wa-pricing"] });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const rows: Array<{ key: keyof Row; label: string; hint: string }> = [
    { key: "price_marketing", label: "Marketing", hint: "Promotional broadcasts (₹1 default)" },
    { key: "price_utility", label: "Utility", hint: "Order confirmations, shipping updates (₹0.30 default)" },
    { key: "price_authentication", label: "Authentication", hint: "OTPs, verification codes (₹0.30 default)" },
    { key: "price_service", label: "Service", hint: "Free-form replies inside 24h window (₹0 default)" },
  ];

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold">WhatsApp pricing</h3>
          <p className="text-xs text-muted-foreground">
            Charged per unique 24-hour conversation per recipient, per store wallet.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.key} className="space-y-1">
              <Label htmlFor={r.key} className="text-xs">{r.label}</Label>
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={r.key}
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-7"
                  value={form[r.key] as number}
                  onChange={(e) => setForm({ ...form, [r.key]: Number(e.target.value) })}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{r.hint}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-[10px] text-muted-foreground">
            Last updated {new Date(form.updated_at).toLocaleString()}
          </p>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save pricing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
