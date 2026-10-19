import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";
import { buildOrdersCsv, collectExportOrders, deliverOrderCsv, type ExportOrder } from "@/lib/orderCsvExport";
import { toast } from "sonner";

const EXPORT_COLUMNS = "id, order_number, created_at, status, total, currency, customer_name, customer_phone, street_address, city, state, pincode, payment_method, payment_type, advance_paid, balance_due, payment_verified, coupon_discount, tracking_number, order_items(id, product_name, quantity, unit_price, total, products(slug, source_path, source_platform))";

export default function OrderCsvExportDialog({ open, onOpenChange, storeId, storeSlug, selectedIds, initialScope }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeSlug?: string;
  selectedIds: string[];
  initialScope: "all" | "selected";
}) {
  const [scope, setScope] = useState<"all" | "selected">(initialScope);
  const [preparing, setPreparing] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; filename: string; count: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setScope(initialScope); setReady(null); setError(""); } }, [open, initialScope, storeId]);

  const prepare = async () => {
    if (preparing || (scope === "selected" && !selectedIds.length)) return;
    setPreparing(true);
    setError("");
    try {
      const cutoff = new Date().toISOString();
      const { data: sourceData, error: sourceError } = await supabase.rpc("get_store_source_config", { p_store_id: storeId });
      if (sourceError) throw sourceError;
      const sourceConfig = Array.isArray(sourceData) ? sourceData[0] : sourceData;
      const orders = await collectExportOrders(async (offset, limit, ids) => {
        let query = supabase.from("orders").select(EXPORT_COLUMNS)
          .eq("store_id", storeId).lte("created_at", cutoff)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(offset, offset + limit - 1);
        if (ids) query = query.in("id", ids);
        const { data, error: readError } = await query;
        if (readError) throw readError;
        return (data ?? []) as ExportOrder[];
      }, scope === "selected" ? [...selectedIds] : undefined);
      if (!orders.length) throw new Error("No orders available to export.");
      const safeSlug = (storeSlug || "store").replace(/[^a-zA-Z0-9_-]/g, "-");
      setReady({ blob: new Blob([buildOrdersCsv(orders, sourceConfig)], { type: "text/csv;charset=utf-8" }),
        filename: `${safeSlug}-orders-${scope}-${cutoff.slice(0, 10)}.csv`, count: orders.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string })?.message || "Couldn't prepare the export. Please try again.");
    } finally { setPreparing(false); }
  };

  return <Dialog open={open} onOpenChange={value => { if (!preparing) onOpenChange(value); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Export orders</DialogTitle><DialogDescription>Order CSV</DialogDescription></DialogHeader>
      <RadioGroup value={scope} disabled={preparing} onValueChange={value => { setScope(value === "selected" ? "selected" : "all"); setReady(null); setError(""); }}>
        <div className="flex items-center gap-2"><RadioGroupItem value="all" id="export-all" /><Label htmlFor="export-all">All orders</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="selected" id="export-selected" disabled={!selectedIds.length} /><Label htmlFor="export-selected">Selected orders ({selectedIds.length})</Label></div>
      </RadioGroup>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {ready ? <>
        <p className="text-sm text-muted-foreground">{ready.count} orders ready</p>
        <Button className="gap-2" onClick={() => { void deliverOrderCsv(ready.blob, ready.filename).catch(() => toast.error("Couldn't download the CSV. Please try again.")); }}><Download className="h-4 w-4" />Download CSV</Button>
      </> : <Button disabled={preparing || (scope === "selected" && !selectedIds.length)} className="gap-2" onClick={() => void prepare()}>
        {preparing && <Loader2 className="h-4 w-4 animate-spin" />}{preparing ? "Preparing…" : "Prepare CSV"}
      </Button>}
    </DialogContent>
  </Dialog>;
}