import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Wallet, Search, Settings2, Plus, Minus } from "lucide-react";
import { format } from "date-fns";
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

async function callControl(body: any) {
  const { data, error } = await supabase.functions.invoke("admin-wallet-controls", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminWallets() {
  const qc = useQueryClient();
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
                  <TableHead className="w-56"></TableHead>
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
                      <div className="flex gap-1">
                        <Button variant="default" size="sm" onClick={() => setManageId(r.store_id)}>
                          <Settings2 className="mr-1 h-3 w-3" /> Manage
                        </Button>
                        <AdjustDialog row={r} onDone={() => qc.invalidateQueries({ queryKey: ["admin-wallets"] })} />
                        <ConfigDialog row={r} onDone={() => qc.invalidateQueries({ queryKey: ["admin-wallets"] })} />
                      </div>
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

function AdjustDialog({ row, onDone }: { row: Row; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: async () => callControl({
      action: "wallet_adjust", store_id: row.store_id,
      direction, amount: Number(amount), note,
    }),
    onSuccess: () => {
      toast.success("Wallet adjusted");
      setOpen(false); setAmount(""); setNote("");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {direction === "credit" ? <Plus className="mr-1 h-3 w-3" /> : <Minus className="mr-1 h-3 w-3" />}
          Adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust wallet — {row.store_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={direction === "credit" ? "default" : "outline"} onClick={() => setDirection("credit")}>Credit</Button>
            <Button type="button" size="sm" variant={direction === "debit" ? "default" : "outline"} onClick={() => setDirection("debit")}>Debit</Button>
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment" maxLength={200} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!amount || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Saving…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfigDialog({ row, onDone }: { row: Row; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(String(row.commission_percentage ?? 3));
  const [minR, setMinR] = useState(String(row.min_recharge ?? 700));
  const [low, setLow] = useState(String(row.low_balance_threshold ?? 100));

  const m = useMutation({
    mutationFn: async () => callControl({
      action: "update_config", store_id: row.store_id,
      commission_percentage: Number(pct),
      min_recharge: Number(minR),
      low_balance_threshold: Number(low),
    }),
    onSuccess: () => { toast.success("Config updated"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Settings2 className="mr-1 h-3 w-3" /> Config</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commission config — {row.store_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Commission %</Label>
            <Input type="number" min="0" max="100" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} />
          </div>
          <div>
            <Label>Min recharge (₹)</Label>
            <Input type="number" min="100" step="1" value={minR} onChange={(e) => setMinR(e.target.value)} />
          </div>
          <div>
            <Label>Low-balance threshold (₹)</Label>
            <Input type="number" min="0" step="1" value={low} onChange={(e) => setLow(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
