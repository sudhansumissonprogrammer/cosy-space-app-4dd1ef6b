import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Smartphone, Building2, Wallet } from "lucide-react";

const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function PartnerWithdrawals() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [accNo, setAccNo] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accName, setAccName] = useState("");

  const load = async () => {
    const { data: res } = await supabase.functions.invoke("partner-wallet", { body: {} });
    if (res) setData(res);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSubmitting(true);
    const body: any = { amount: amt, method };
    if (method === "upi") body.upi_id = upi.trim();
    else { body.bank_account_no = accNo.trim(); body.bank_ifsc = ifsc.trim(); body.bank_account_name = accName.trim(); }
    const { data: res, error } = await supabase.functions.invoke("partner-request-withdrawal", { body });
    setSubmitting(false);
    if (error || res?.error) {
      toast.error(res?.error || error?.message || "Failed");
      return;
    }
    toast.success("Withdrawal requested");
    setAmount(""); setUpi(""); setAccNo(""); setIfsc(""); setAccName("");
    load();
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this withdrawal request?")) return;
    const { data: res, error } = await supabase.functions.invoke("partner-cancel-withdrawal", { body: { withdrawal_id: id } });
    if (error || res?.error) return toast.error(res?.error || error?.message || "Failed");
    toast.success("Cancelled");
    load();
  };

  if (loading || !data) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const { wallet, withdrawals, settings } = data;
  const statusTone: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    approved: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    cancelled: "bg-muted text-muted-foreground",
  };

  const setQuick = (pct: number | "max") => {
    const max = wallet.withdrawable;
    const v = pct === "max" ? max : Math.floor((max * pct) / 100);
    setAmount(String(v));
  };

  return (
    <>
      {/* Balance strip */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-primary via-primary to-primary/70 p-4 text-primary-foreground shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider opacity-90">Available to withdraw</p>
            <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{fmt(wallet.withdrawable)}</p>
          </div>
          <Wallet className="h-8 w-8 opacity-30" />
        </div>
        <p className="mt-1 text-xs opacity-80">Minimum withdrawal: {fmt(settings.minimum_withdrawal)}</p>
      </Card>

      {/* Request form */}
      <Card className="rounded-2xl border p-5 shadow-none">
        <h3 className="text-sm font-bold tracking-tight text-foreground">Request withdrawal</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Funds usually arrive within 1–3 business days.</p>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min={settings.minimum_withdrawal}
              max={wallet.withdrawable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className="h-11 text-base"
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "25%", v: 25 as const },
                { label: "50%", v: 50 as const },
                { label: "75%", v: 75 as const },
                { label: "Max", v: "max" as const },
              ].map((q) => (
                <Button key={q.label} type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setQuick(q.v)}>
                  {q.label}
                </Button>
              ))}
            </div>
          </div>

          <Tabs value={method} onValueChange={(v) => setMethod(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upi" className="gap-1.5"><Smartphone className="h-3.5 w-3.5" />UPI</TabsTrigger>
              <TabsTrigger value="bank" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />Bank</TabsTrigger>
            </TabsList>
            <TabsContent value="upi" className="mt-4 space-y-2">
              <Label htmlFor="upi" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">UPI ID</Label>
              <Input id="upi" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" className="h-11" />
            </TabsContent>
            <TabsContent value="bank" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="accname" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account holder name</Label>
                <Input id="accname" value={accName} onChange={(e) => setAccName(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accno" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account number</Label>
                <Input id="accno" value={accNo} onChange={(e) => setAccNo(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifsc" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">IFSC code</Label>
                <Input id="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" className="h-11 font-mono" />
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" disabled={submitting || wallet.withdrawable < settings.minimum_withdrawal} className="h-11 w-full">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
            Request withdrawal
          </Button>
        </form>
      </Card>

      {/* History */}
      <Card className="rounded-2xl border p-5 shadow-none">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Withdrawal history</h3>
          <span className="text-[11px] text-muted-foreground">{withdrawals.length} entries</span>
        </div>
        <div className="mt-3 space-y-2">
          {withdrawals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <ArrowDownToLine className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">No withdrawals yet.</p>
            </div>
          ) : withdrawals.map((w: any) => (
            <div key={w.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {w.method === "upi" ? <Smartphone className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold tabular-nums text-foreground">{fmt(w.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {w.method.toUpperCase()} · {new Date(w.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {w.payout_ref && <> · UTR: <span className="font-mono">{w.payout_ref}</span></>}
                  </p>
                  {w.admin_note && <p className="mt-0.5 text-[11px] italic text-muted-foreground">"{w.admin_note}"</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone[w.status] || "bg-muted"}`}>
                  {w.status}
                </span>
                {w.status === "pending" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => cancel(w.id)}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
