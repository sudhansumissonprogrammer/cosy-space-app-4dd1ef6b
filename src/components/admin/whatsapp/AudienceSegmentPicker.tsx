import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Segment = "all" | "with_orders" | "without_orders" | "high_value" | "abandoned_cart" | "vip" | "last_order_30d" | "inactive_90d";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "all", label: "All customers" },
  { value: "with_orders", label: "Customers with orders" },
  { value: "without_orders", label: "Customers without orders" },
  { value: "high_value", label: "High value (₹5k+ lifetime)" },
  { value: "abandoned_cart", label: "Abandoned cart (last 7d)" },
  { value: "vip", label: "VIP (3+ orders)" },
  { value: "last_order_30d", label: "Last order < 30 days" },
  { value: "inactive_90d", label: "Inactive 90+ days" },
];

export type AudienceFilter = {
  segment: Segment;
  store_id?: string | null;
};

export function AudienceSegmentPicker({ value, onChange }: { value: AudienceFilter; onChange: (v: AudienceFilter) => void }) {
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [preview, setPreview] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("stores").select("id, name").order("name").limit(500).then(({ data }) => setStores((data as any) || []));
  }, []);

  const estimate = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("expand_campaign_audience" as any, { _filter: value });
    setPreview(((data as any) || []).length);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Segment</Label>
          <Select value={value.segment} onValueChange={(v) => onChange({ ...value, segment: v as Segment })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Store (optional)</Label>
          <Select value={value.store_id || "__all__"} onValueChange={(v) => onChange({ ...value, store_id: v === "__all__" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All stores</SelectItem>
              {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={estimate} disabled={loading}>{loading ? "Estimating…" : "Estimate audience"}</Button>
        {preview != null && <Badge variant="secondary">{preview.toLocaleString("en-IN")} recipients</Badge>}
      </div>
    </div>
  );
}
