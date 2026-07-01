import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";

type Segment =
  | "all" | "with_orders" | "without_orders" | "high_value"
  | "abandoned_cart" | "vip" | "last_order_30d" | "inactive_90d"
  | "csv";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "all", label: "All customers" },
  { value: "with_orders", label: "Customers with orders" },
  { value: "without_orders", label: "Customers without orders" },
  { value: "high_value", label: "High value (₹5k+ lifetime)" },
  { value: "abandoned_cart", label: "Abandoned cart (last 7d)" },
  { value: "vip", label: "VIP (3+ orders)" },
  { value: "last_order_30d", label: "Last order < 30 days" },
  { value: "inactive_90d", label: "Inactive 90+ days" },
  { value: "csv", label: "Upload phone list (CSV)" },
];

export type AudienceFilter = {
  segment: Segment;
  store_id?: string | null;
  phones?: string[];
};

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d]/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) d = "91" + d;
  if (d.length < 11 || d.length > 15) return null;
  return d;
}

function parseCsv(text: string): string[] {
  const out = new Set<string>();
  for (const raw of text.split(/[\r\n,;\t]+/)) {
    const p = normalizePhone(raw);
    if (p) out.add(p);
  }
  return Array.from(out);
}

export function AudienceSegmentPicker({ value, onChange }: { value: AudienceFilter; onChange: (v: AudienceFilter) => void }) {
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [preview, setPreview] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      // Paginate — 500-cap silently truncated the store dropdown.
      const PAGE = 1000;
      const rows: { id: string; name: string }[] = [];
      for (let from = 0; from < 20_000; from += PAGE) {
        const { data, error } = await supabase
          .from("stores")
          .select("id, name")
          .order("name")
          .range(from, from + PAGE - 1);
        if (error) break;
        const batch = (data || []) as any[];
        rows.push(...batch);
        if (batch.length < PAGE) break;
      }
      setStores(rows);
    })();
  }, []);

  const estimate = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("expand_campaign_audience" as any, { _filter: value });
    setPreview(((data as any) || []).length);
    setLoading(false);
  };

  const handleFile = async (f: File) => {
    if (f.size > 2 * 1024 * 1024) { toast.error("CSV must be under 2 MB"); return; }
    const text = await f.text();
    const phones = parseCsv(text);
    if (!phones.length) { toast.error("No valid phone numbers found"); return; }
    if (phones.length > 50_000) { toast.error("Max 50,000 numbers per upload"); return; }
    onChange({ ...value, segment: "csv", phones });
    setPreview(phones.length);
    toast.success(`${phones.length.toLocaleString("en-IN")} numbers loaded`);
  };

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Segment</Label>
          <Select value={value.segment} onValueChange={(v) => onChange({ ...value, segment: v as Segment, phones: v === "csv" ? value.phones : undefined })}>
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

      {value.segment === "csv" && (
        <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1"><FileText className="h-3 w-3"/> Phone CSV</Label>
            {!!value.phones?.length && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { onChange({ ...value, phones: [] }); setPreview(0); }}>
                <X className="h-3 w-3 mr-1"/>Clear
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1"/>Choose file
            </Button>
            <span className="text-[11px] text-muted-foreground">
              One number per line or comma-separated. 10-digit Indian numbers auto-prefix to 91. Max 50k.
            </span>
          </div>
          {!!value.phones?.length && (
            <Badge variant="secondary">{value.phones.length.toLocaleString("en-IN")} valid numbers</Badge>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={estimate} disabled={loading}>{loading ? "Estimating…" : "Estimate audience"}</Button>
        {preview != null && <Badge variant="secondary">{preview.toLocaleString("en-IN")} recipients</Badge>}
      </div>
    </div>
  );
}
