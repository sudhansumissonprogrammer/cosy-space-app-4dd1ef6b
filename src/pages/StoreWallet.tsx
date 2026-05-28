import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import WalletAccountCard from "@/components/billing/WalletAccountCard";

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

  const ledger: any[] = ((data as any)?.ledger ?? []).filter(
    (l: any) => l.direction === "credit"
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Wallet</h1>

      <WalletAccountCard
        storeId={storeId}
        storeSlug={(store as any)?.slug}
        variant="full"
      />

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-3">Recent activity</p>
          {ledger.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {ledger.slice(0, 30).map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 border-b pb-2 last:border-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${l.direction === "credit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {l.direction === "credit" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{l.notes || l.kind}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold tabular-nums ${l.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                      {l.direction === "credit" ? "+" : "−"}₹{Number(l.amount).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">bal ₹{Number(l.balance_after).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
