import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, Search, Settings2 } from "lucide-react";
import ManageStoreDialog from "@/components/admin/ManageStoreDialog";

interface Row {
  store_id: string;
  store_name: string;
  store_slug: string;
  balance: number;
  total_recharged: number;
  total_charged: number;
  commission_percentage: number | null;
  min_recharge: number | null;
  low_balance_threshold: number | null;
  is_active: boolean | null;
}

export default function AdminWallets() {
  useDocumentTitle("Wallets · Admin");
  const [search, setSearch] = useState("");
  const [manageId, setManageId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-wallets"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: stores, error } = await supabase
        .from("stores")
        .select("id, name, slug")
        .eq("billing_mode", "commission")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (stores ?? []).map((s) => s.id);
      if (!ids.length) return [] as Row[];

      const [{ data: wallets }, { data: configs }] = await Promise.all([
        supabase.from("store_wallets").select("*").in("store_id", ids),
        supabase.from("store_commission_config").select("*").in("store_id", ids),
      ]);
      const wMap = new Map((wallets ?? []).map((w: any) => [w.store_id, w]));
      const cMap = new Map((configs ?? []).map((c: any) => [c.store_id, c]));

      return (stores ?? []).map((s: any): Row => {
        const w: any = wMap.get(s.id) ?? {};
        const c: any = cMap.get(s.id) ?? {};
        return {
          store_id: s.id, store_name: s.name, store_slug: s.slug,
          balance: Number(w.balance ?? 0),
          total_recharged: Number(w.total_recharged ?? 0),
          total_charged: Number(w.total_charged ?? 0),
          commission_percentage: c.commission_percentage ?? null,
          min_recharge: c.min_recharge ?? null,
          low_balance_threshold: c.low_balance_threshold ?? null,
          is_active: c.is_active ?? null,
        };
      });
    },
  });

  const filtered = (rows ?? []).filter((r) => {
    const q = search.toLowerCase();
    return !q || r.store_name?.toLowerCase().includes(q) || r.store_slug?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Commission Wallets</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search store..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            maxLength={100}
          />
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <p className="text-muted-foreground">No stores on commission billing yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Recharged</TableHead>
                  <TableHead className="text-right">Charged</TableHead>
                  <TableHead className="text-center">Rate</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const neg = r.balance < 0;
                  return (
                  <TableRow key={r.store_id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{r.store_name}</p>
                      <p className="text-xs text-muted-foreground">/{r.store_slug}</p>
                    </TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${neg ? "text-destructive" : ""}`}>
                      {neg ? "−" : ""}₹{Math.abs(r.balance).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      ₹{r.total_recharged.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      ₹{r.total_charged.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {r.commission_percentage != null ? `${r.commission_percentage}%` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {neg ? (
                        <Badge variant="destructive">Negative</Badge>
                      ) : r.balance <= (r.low_balance_threshold ?? 100) ? (
                        <Badge variant="destructive">Low</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="default" size="sm" onClick={() => setManageId(r.store_id)}>
                        <Settings2 className="mr-1 h-3 w-3" /> Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ManageStoreDialog
        storeId={manageId}
        open={!!manageId}
        onOpenChange={(o) => { if (!o) setManageId(null); }}
        defaultTab="wallet"
      />
    </div>
  );
}
