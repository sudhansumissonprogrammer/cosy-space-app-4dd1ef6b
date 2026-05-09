import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Smartphone, Building2 } from "lucide-react";

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

  if (loading || !data) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-foreground" /></div>;

  const { wallet, withdrawals, settings } = data;
  const statusTone: Record<string, string> = {
    pending: "bg-bauhaus-yellow",
    approved: "bg-bauhaus-blue text-primary-foreground",
    paid: "bg-bauhaus-red text-primary-foreground",
    rejected: "bg-foreground text-primary-foreground",
    cancelled: "bg-bauhaus-canvas",
  };

  const insufficient = wallet.withdrawable < settings.minimum_withdrawal;

  return (
    <>
      {/* Request form */}
      <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus-lg p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h3 className="font-black uppercase tracking-wider text-base text-foreground">Request Withdrawal</h3>
            <p className="mt-1 font-medium text-xs text-muted-foreground">
              Withdrawable: <span className="font-black text-foreground">{fmt(wallet.withdrawable)}</span> · Min: <span className="font-bold">{fmt(settings.minimum_withdrawal)}</span>
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block font-bold uppercase tracking-widest text-[10px] text-foreground mb-1.5">Amount (₹)</label>
            <input
              type="number" step="0.01" min={settings.minimum_withdrawal} max={wallet.withdrawable}
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500"
              className="w-full bg-bauhaus-canvas text-foreground border-2 border-foreground px-3 py-2.5 font-bold text-base tabular-nums focus:outline-none focus:shadow-bauhaus-sm focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all"
            />
          </div>

          {/* Method tabs */}
          <div>
            <label className="block font-bold uppercase tracking-widest text-[10px] text-foreground mb-1.5">Method</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "upi", label: "UPI", icon: Smartphone, color: "bg-bauhaus-yellow" },
                { value: "bank", label: "Bank Transfer", icon: Building2, color: "bg-bauhaus-blue", text: "text-primary-foreground" },
              ].map((m) => {
                const active = method === m.value;
                return (
                  <button
                    key={m.value} type="button"
                    onClick={() => setMethod(m.value as any)}
                    className={`inline-flex items-center justify-center gap-2 border-2 border-foreground px-3 py-2.5 font-bold uppercase tracking-wider text-[11px] transition-all ${active ? `${m.color} ${m.text || "text-foreground"} shadow-bauhaus-sm` : "bg-bauhaus-white text-foreground hover:bg-muted"}`}
                  >
                    <m.icon className="h-3.5 w-3.5" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {method === "upi" ? (
            <FormField id="upi" label="UPI ID" value={upi} onChange={setUpi} placeholder="name@bank" />
          ) : (
            <div className="space-y-3">
              <FormField id="accname" label="Account holder name" value={accName} onChange={setAccName} />
              <FormField id="accno" label="Account number" value={accNo} onChange={setAccNo} />
              <FormField id="ifsc" label="IFSC code" value={ifsc} onChange={(v) => setIfsc(v.toUpperCase())} placeholder="HDFC0001234" />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || insufficient}
            className="w-full inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-6 py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDownToLine className="h-4 w-4" /> Request Withdrawal</>}
          </button>
          {insufficient && (
            <p className="text-center font-medium text-xs text-muted-foreground">
              You need at least {fmt(settings.minimum_withdrawal)} approved balance to withdraw.
            </p>
          )}
        </form>
      </div>

      {/* History */}
      <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus p-5">
        <h3 className="font-black uppercase tracking-wider text-sm text-foreground mb-3">Withdrawal History</h3>

        {withdrawals.length === 0 ? (
          <p className="py-6 text-center font-medium text-xs text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((w: any) => (
              <div key={w.id} className="flex flex-col gap-2 border-2 border-foreground bg-bauhaus-canvas p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm text-foreground tabular-nums">
                    {fmt(w.amount)} <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">· {w.method.toUpperCase()}</span>
                  </p>
                  <p className="font-medium text-[11px] text-muted-foreground">
                    Requested {new Date(w.created_at).toLocaleDateString("en-IN")}
                    {w.payout_ref && <> · UTR: <span className="font-mono">{w.payout_ref}</span></>}
                  </p>
                  {w.admin_note && <p className="mt-0.5 font-medium text-[11px] italic text-muted-foreground">"{w.admin_note}"</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`border-2 border-foreground px-2 py-0.5 font-bold uppercase tracking-widest text-[10px] ${statusTone[w.status] || "bg-bauhaus-white"}`}>
                    {w.status}
                  </span>
                  {w.status === "pending" && (
                    <button
                      onClick={() => cancel(w.id)}
                      className="border-2 border-foreground bg-bauhaus-white px-2 py-0.5 font-bold uppercase tracking-widest text-[10px] text-foreground hover:bg-muted shadow-bauhaus-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function FormField({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block font-bold uppercase tracking-widest text-[10px] text-foreground mb-1.5">{label}</label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bauhaus-canvas text-foreground border-2 border-foreground px-3 py-2.5 font-medium text-sm focus:outline-none focus:shadow-bauhaus-sm focus:-translate-x-[1px] focus:-translate-y-[1px] transition-all"
      />
    </div>
  );
}
