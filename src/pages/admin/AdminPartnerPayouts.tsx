import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

type Action = "approve" | "reject" | "mark_paid";

export default function AdminPartnerPayouts() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [actDialog, setActDialog] = useState<{ row: any; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [payoutRef, setPayoutRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: res } = await supabase.functions.invoke("admin-partner-payouts", { body: {} });
    setRows(res?.withdrawals || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => filter === "all" ? true : r.status === filter);

  const exportCsv = () => {
    const headers = ["id", "partner_code", "partner_name", "amount", "method", "upi_id", "bank_account_no", "bank_ifsc", "status", "payout_ref", "created_at", "paid_at"];
    const lines = [headers.join(",")];
    filtered.forEach(r => {
      lines.push(headers.map(h => {
        const v = h === "partner_code" ? r.partner?.partner_code
              : h === "partner_name" ? r.partner?.name
              : (r as any)[h];
        return JSON.stringify(v ?? "");
      }).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `partner-payouts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const submitAction = async () => {
    if (!actDialog) return;
    if (actDialog.action === "mark_paid" && !payoutRef.trim()) return toast.error("Payout reference required");
    setSubmitting(true);
    const { data: res, error } = await supabase.functions.invoke("admin-withdrawal-action", {
      body: {
        withdrawal_id: actDialog.row.id,
        action: actDialog.action,
        note: note.trim() || undefined,
        payout_ref: payoutRef.trim() || undefined,
      },
    });
    setSubmitting(false);
    if (error || res?.error) return toast.error(res?.error || error?.message || "Failed");
    toast.success("Done");
    setActDialog(null); setNote(""); setPayoutRef("");
    load();
  };

  const statusTone: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-blue-100 text-blue-700",
    paid: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Partner Payouts</h1>
          <p className="text-sm text-muted-foreground">Review and process withdrawal requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No requests in this state.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{fmt(r.amount)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusTone[r.status] || "bg-muted"}`}>{r.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.partner?.partner_code} · {r.partner?.name} · {r.partner?.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.method === "upi"
                      ? <>UPI: <span className="font-mono">{r.upi_id}</span></>
                      : <>Bank: <span className="font-mono">{r.bank_account_no}</span> / {r.bank_ifsc} ({r.bank_account_name})</>}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Requested {new Date(r.created_at).toLocaleString()}
                    {r.payout_ref && <> · UTR: <span className="font-mono">{r.payout_ref}</span></>}
                  </p>
                  {r.admin_note && <p className="mt-1 text-xs italic text-muted-foreground">"{r.admin_note}"</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => { setActDialog({ row: r, action: "approve" }); setNote(""); }}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => { setActDialog({ row: r, action: "reject" }); setNote(""); }}>Reject</Button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <>
                      <Button size="sm" onClick={() => { setActDialog({ row: r, action: "mark_paid" }); setNote(""); setPayoutRef(""); }}>Mark Paid</Button>
                      <Button size="sm" variant="outline" onClick={() => { setActDialog({ row: r, action: "reject" }); setNote(""); }}>Reject</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!actDialog} onOpenChange={(o) => !o && setActDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actDialog?.action.replace("_", " ")} withdrawal</DialogTitle>
          </DialogHeader>
          {actDialog && (
            <div className="space-y-3">
              <p className="text-sm">
                {fmt(actDialog.row.amount)} to {actDialog.row.partner?.name}
              </p>
              {actDialog.action === "mark_paid" && (
                <div>
                  <Label htmlFor="ref">Payout reference / UTR</Label>
                  <Input id="ref" value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} required />
                </div>
              )}
              <div>
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActDialog(null)}>Cancel</Button>
            <Button onClick={submitAction} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
