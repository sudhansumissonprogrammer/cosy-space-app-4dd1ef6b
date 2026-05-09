import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function AdminPartnerExports() {
  const [kind, setKind] = useState("commissions");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ kind });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (partnerId) params.set("partner_id", partnerId);
      if (status) params.set("status", status);
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/partner-exports?${params}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${kind}-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Exported");
    } catch (e: any) { toast.error(e.message || "Export failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Exports & reports</h1>
        <p className="text-sm text-muted-foreground">Download CSV reports for accounting and analysis.</p>
      </div>
      <Card className="grid max-w-2xl gap-3 p-5">
        <div className="grid gap-2">
          <Label>Report</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="commissions">Commissions</SelectItem>
              <SelectItem value="payouts">Payouts</SelectItem>
              <SelectItem value="partner-performance">Partner performance</SelectItem>
              <SelectItem value="subscriptions">Referred subscriptions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="grid gap-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="grid gap-2"><Label>Partner ID (optional)</Label><Input value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="UUID" /></div>
        {(kind === "commissions" || kind === "payouts") && (
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(kind === "commissions" ? ["pending","approved","reversed","paid"] : ["pending","approved","rejected","paid"]).map((s) =>
                  <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button disabled={busy} onClick={download}><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
      </Card>
    </div>
  );
}
