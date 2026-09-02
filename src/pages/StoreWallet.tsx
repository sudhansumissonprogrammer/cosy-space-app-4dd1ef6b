import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle, Download, ChevronDown, ChevronRight, MessageCircle } from "lucide-react";
import WalletAccountCard from "@/components/billing/WalletAccountCard";
import WhatsAppUsageCard from "@/components/wallet/WhatsAppUsageCard";
import { downloadWalletInvoice } from "@/lib/walletInvoice";

function renderLedgerLabel(l: any): string {
  if (l.kind === "wa_conversation" && l.notes) {
    try {
      const n = typeof l.notes === "string" ? JSON.parse(l.notes) : l.notes;
      const cat = String(n.category || "marketing");
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const phone = String(n.recipient_phone || "");
      const masked = phone.length >= 6 ? `${phone.slice(0, 2)}…${phone.slice(-4)}` : phone;
      return `WhatsApp ${label} → ${masked}`;
    } catch { /* fall through */ }
  }
  return l.notes || l.kind;
}

export default function StoreWallet() {
  const { store, storeId } = useDashboardStore();

  const { data, isLoading } = useQuery({
    queryKey: ["store-wallet", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_wallet_summary", { _store_id: storeId! });
      if (error) throw error;
      return data as any;
    },
  });

  if (!storeId) return null;
  const isCommission = (data as any)?.billing_mode === "commission";

  if (!isLoading && !isCommission) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Wallet is only available for commission-billing stores. Contact support to switch.
        </CardContent>
      </Card>
    );
  }

  const ledger: any[] = (data as any)?.ledger ?? [];

  const recharges: any[] = (data as any)?.recharges ?? [];
  const rechargeById = new Map(recharges.map((r) => [r.id, r]));

  const invoiceFor = (l: any) => {
    if (l.kind === "recharge" && l.recharge_id) {
      const r = rechargeById.get(l.recharge_id);
      if (!r) return;
      downloadWalletInvoice({
        kind: "recharge",
        id: r.id,
        createdAt: r.paid_at || r.created_at,
        amount: Number(r.amount),
        paymentMethod: r.payment_method,
        paymentRef: r.cashfree_payment_id || r.cashfree_order_id,
        store: store as any,
      });
    } else if (l.kind === "admin_adjustment" && l.direction === "credit") {
      downloadWalletInvoice({
        kind: "credit_note",
        id: l.id,
        createdAt: l.created_at,
        amount: Number(l.amount),
        notes: l.notes,
        store: store as any,
      });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Wallet</h1>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <WalletAccountCard
          storeId={storeId}
          storeSlug={(store as any)?.slug}
          variant="full"
        />

        <WhatsAppUsageCard storeId={storeId} />
      </div>


      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-3">Recent activity</p>
          {ledger.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No transactions yet</p>
          ) : (
            <WalletActivityList ledger={ledger} invoiceFor={invoiceFor} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type GroupItem =
  | { type: "single"; entry: any }
  | { type: "wa_group"; dayKey: string; date: string; entries: any[]; total: number; balance_after: number };

function buildActivityItems(ledger: any[]): GroupItem[] {
  const items: GroupItem[] = [];
  // Group ONLY consecutive WhatsApp charges so the displayed running balance
  // stays consistent with the ledger (a day-wide group would show a big total
  // next to a balance that only moved by the last entry's amount).
  let current: (GroupItem & { type: "wa_group" }) | null = null;

  for (const l of ledger) {
    if (l.kind === "wa_conversation") {
      const d = new Date(l.created_at);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!current) {
        current = {
          type: "wa_group",
          dayKey: `${dayKey}-${l.id}`,
          date: l.created_at,
          entries: [],
          total: 0,
          // ledger is ordered desc → first entry of the run holds the latest balance
          balance_after: Number(l.balance_after),
        };
        items.push(current);
      }
      current.entries.push(l);
      current.total += Number(l.amount);
    } else {
      current = null;
      items.push({ type: "single", entry: l });
    }
  }
  return items;
}


function WalletActivityList({ ledger, invoiceFor }: { ledger: any[]; invoiceFor: (l: any) => void }) {
  const items = useMemo(() => buildActivityItems(ledger).slice(0, 30), [ledger]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-2">
      {items.map((it) => {
        if (it.type === "wa_group") {
          const isOpen = !!expanded[it.dayKey];
          // Aggregate by category
          const byCat: Record<string, { count: number; msgs: number; amount: number }> = {};
          for (const e of it.entries) {
            let cat = "marketing";
            let msgCount = 1;
            try {
              const n = typeof e.notes === "string" ? JSON.parse(e.notes) : e.notes;
              if (n?.category) cat = String(n.category);
              if (n?.message_count) msgCount = Number(n.message_count);
            } catch {}
            const b = byCat[cat] ?? { count: 0, msgs: 0, amount: 0 };
            b.count += 1;
            b.msgs += msgCount;
            b.amount += Number(e.amount);
            byCat[cat] = b;
          }
          const totalMsgs = Object.values(byCat).reduce((a, b) => a + b.msgs, 0);
          return (
            <div key={it.dayKey} className="border-b pb-2 last:border-0">
              <button
                type="button"
                onClick={() => setExpanded((s) => ({ ...s, [it.dayKey]: !isOpen }))}
                className="flex w-full items-center gap-3 text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate flex items-center gap-1">
                    WhatsApp usage · {it.entries.length} conv · {totalMsgs} msg
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(it.date).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-rose-600">−₹{it.total.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">bal ₹{Number(it.balance_after).toFixed(2)}</p>
                </div>
              </button>
              {isOpen && (
                <div className="mt-2 ml-11 space-y-1 rounded-md bg-muted/40 p-2">
                  {Object.entries(byCat).map(([cat, v]) => (
                    <div key={cat} className="flex items-center justify-between text-[11px]">
                      <span className="capitalize">{cat}</span>
                      <span className="text-muted-foreground">
                        {v.count} conv · {v.msgs} msg
                      </span>
                      <span className="w-16 text-right font-semibold tabular-nums">₹{v.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        const l = it.entry;
        const hasInvoice =
          (l.kind === "recharge" && l.recharge_id) ||
          (l.kind === "admin_adjustment" && l.direction === "credit");
        return (
          <div key={l.id} className="flex items-center gap-3 border-b pb-2 last:border-0">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${l.direction === "credit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {l.direction === "credit" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{renderLedgerLabel(l)}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold tabular-nums ${l.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                {l.direction === "credit" ? "+" : "−"}₹{Number(l.amount).toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">bal ₹{Number(l.balance_after).toFixed(2)}</p>
            </div>
            {hasInvoice && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Download invoice"
                onClick={() => invoiceFor(l)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
