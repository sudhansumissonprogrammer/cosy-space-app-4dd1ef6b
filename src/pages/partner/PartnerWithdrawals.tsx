import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine } from "lucide-react";

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
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-blue-100 text-blue-700",
    paid: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Request withdrawal</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Withdrawable: <span className="font-semibold text-foreground">{fmt(wallet.withdrawable)}</span> · Minimum: {fmt(settings.minimum_withdrawal)}
        </p>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input id="amount" type="number" step="0.01" min={settings.minimum_withdrawal} max={wallet.withdrawable}
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
          </div>

          <Tabs value={method} onValueChange={(v) => setMethod(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upi">UPI</TabsTrigger>
              <TabsTrigger value="bank">Bank Transfer</TabsTrigger>
            </TabsList>
            <TabsContent value="upi" className="mt-4 space-y-2">
              <Label htmlFor="upi">UPI ID</Label>
              <Input id="upi" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" />
            </TabsContent>
            <TabsContent value="bank" className="mt-4 space-y-3">
              <div>
                <Label htmlFor="accname">Account holder name</Label>
                <Input id="accname" value={accName} onChange={(e) => setAccName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="accno">Account number</Label>
                <Input id="accno" value={accNo} onChange={(e) => setAccNo(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ifsc">IFSC code</Label>
                <Input id="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" />
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" disabled={submitting || wallet.withdrawable < settings.minimum_withdrawal} className="w-full">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
            Request withdrawal
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Withdrawal history</h3>
        <div className="mt-3 space-y-2">
          {withdrawals.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No withdrawals yet.</p>
          ) : withdrawals.map((w: any) => (
            <div key={w.id} className="flex flex-col gap-2 rounded-lg border border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{fmt(w.amount)} · <span className="font-normal text-muted-foreground">{w.method.toUpperCase()}</span></p>
                <p className="text-xs text-muted-foreground">
                  Requested {new Date(w.created_at).toLocaleDateString()}
                  {w.payout_ref && <> · UTR: <span className="font-mono">{w.payout_ref}</span></>}
                </p>
                {w.admin_note && <p className="mt-0.5 text-xs italic text-muted-foreground">"{w.admin_note}"</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusTone[w.status] || "bg-muted"}`}>{w.status}</span>
                {w.status === "pending" && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(w.id)}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
