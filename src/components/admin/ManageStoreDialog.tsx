import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Store, Wallet, Plus, Minus, Ban, CheckCircle, BadgeCheck, ExternalLink, Download,
} from "lucide-react";
import { downloadWalletInvoice } from "@/lib/walletInvoice";

type Tab = "overview" | "billing" | "wallet" | "danger";

interface Props {
  storeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: Tab;
}

async function callControl(body: any) {
  const { data, error } = await supabase.functions.invoke("admin-wallet-controls", { body });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export default function ManageStoreDialog({ storeId, open, onOpenChange, defaultTab = "overview" }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(defaultTab);

  useEffect(() => { if (open) setTab(defaultTab); }, [open, defaultTab]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["manage-store", storeId],
    enabled: !!storeId && open,
    staleTime: 0,
    queryFn: async () => {
      const summary = await callControl({ action: "get_summary", store_id: storeId });
      const { data: owner } = await supabase.from("stores").select("owner_id").eq("id", storeId).maybeSingle();
      let ownerProfile: any = null;
      if (owner?.owner_id) {
        const { data: p } = await supabase.from("profiles").select("full_name, is_blocked, user_id").eq("user_id", owner.owner_id).maybeSingle();
        ownerProfile = p;
      }
      return { ...summary, ownerProfile };
    },
  });

  const store = data?.store as any;
  const wallet = data?.wallet as any;
  const config = data?.config as any;
  const ledger = (data?.ledger ?? []) as any[];
  const recharges = (data?.recharges ?? []) as any[];
  const ownerProfile = (data as any)?.ownerProfile;

  const invalidateAll = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["admin-wallets"] });
    qc.invalidateQueries({ queryKey: ["admin-users-stores"] });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            {store?.name ?? "Manage Store"}
            {store?.slug && <span className="text-sm font-normal text-muted-foreground">/{store.slug}</span>}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !store ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            {/* Commission model summary */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="gap-1">
                  <Wallet className="h-3 w-3" /> Commission-only
                </Badge>
                <p className="text-xs text-muted-foreground">
                  All stores use wallet-based commission billing. Legacy subscriptions are disabled.
                </p>
              </div>
              {store.slug && (
                <a
                  href={`/dashboard/stores/${store.slug}/products`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" /> Open dashboard
                </a>
              )}
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="billing">Commission</TabsTrigger>
                <TabsTrigger value="wallet">Wallet</TabsTrigger>
                <TabsTrigger value="danger">Danger</TabsTrigger>
              </TabsList>

              {/* OVERVIEW */}
              <TabsContent value="overview">
                <OverviewTab store={store} owner={ownerProfile} wallet={wallet} config={config} />
              </TabsContent>

              {/* BILLING */}
              <TabsContent value="billing">
                <CommissionConfigPanel storeId={storeId!} config={config} onSaved={invalidateAll} />
              </TabsContent>

              {/* WALLET */}
              <TabsContent value="wallet">
                <WalletPanel
                  storeId={storeId!}
                  store={store}
                  wallet={wallet}
                  ledger={ledger}
                  recharges={recharges}
                  onSaved={invalidateAll}
                />
              </TabsContent>

              {/* DANGER */}
              <TabsContent value="danger">
                <DangerPanel store={store} owner={ownerProfile} onChanged={invalidateAll} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Overview ────────────────────────────────────────────── */

function OverviewTab({ store, owner, wallet, config }: any) {
  const stats = [
    { label: "Mode", value: "Commission" },
    { label: "Suspended", value: store.is_suspended ? "Yes" : "No" },
    { label: "Verified", value: store.is_verified ? "Yes" : "No" },
    { label: "Owner blocked", value: owner?.is_blocked ? "Yes" : "No" },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-xs uppercase text-muted-foreground">{s.label}</p>
              <p className="text-sm font-medium">{s.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 p-4 text-sm">
          <p><span className="text-muted-foreground">Owner:</span> {owner?.full_name || "—"}</p>
          <p><span className="text-muted-foreground">Created:</span> {store.created_at ? format(new Date(store.created_at), "PPP") : "—"}</p>
          <p><span className="text-muted-foreground">Wallet balance:</span> ₹{Number(wallet?.balance ?? 0).toFixed(2)}</p>
          <p><span className="text-muted-foreground">Commission %:</span> {config?.commission_percentage ?? 3}%</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Commission Config Panel ─────────────────────────────── */

function CommissionConfigPanel({ storeId, config, onSaved }: any) {
  const [pct, setPct] = useState(String(config?.commission_percentage ?? 3));
  const [minR, setMinR] = useState(String(config?.min_recharge ?? 600));
...
    setMinR(String(config?.min_recharge ?? 600));
    setLow(String(config?.low_balance_threshold ?? 100));
  }, [config?.commission_percentage, config?.min_recharge, config?.low_balance_threshold]);

  const save = useMutation({
    mutationFn: () => callControl({
      action: "update_config", store_id: storeId,
      commission_percentage: Number(pct),
      min_recharge: Number(minR),
      low_balance_threshold: Number(low),
    }),
    onSuccess: () => { toast.success("Commission config updated"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Commission is charged from the store's wallet whenever an order is confirmed/shipped/delivered. Wallet can go negative; the store must recharge to keep accepting orders past the low-balance threshold.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label>Commission % per order</Label>
            <Input type="number" min="0" max="100" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} />
          </div>
          <div>
            <Label>Min recharge (₹)</Label>
            <Input type="number" min="100" max="100000" value={minR} onChange={(e) => setMinR(e.target.value)} />
          </div>
          <div>
            <Label>Low-balance alert (₹)</Label>
            <Input type="number" min="0" value={low} onChange={(e) => setLow(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save config"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Wallet Panel ────────────────────────────────────────── */

function WalletPanel({ storeId, store, wallet, ledger, recharges, onSaved }: any) {
  const balance = Number(wallet?.balance ?? 0);
  const totalRecharged = Number(wallet?.total_recharged ?? 0);
  const totalCharged = Number(wallet?.total_charged ?? 0);

  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const adjust = useMutation({
    mutationFn: () => callControl({
      action: "wallet_adjust", store_id: storeId,
      direction, amount: Number(amount), note,
    }),
    onSuccess: () => {
      toast.success("Wallet adjusted");
      setAmount(""); setNote("");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Balance</p>
          <p className={`text-2xl font-semibold tabular-nums ${balance < 0 ? "text-destructive" : ""}`}>
            {balance < 0 ? "−" : ""}₹{Math.abs(balance).toFixed(2)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Total recharged</p>
          <p className="text-2xl font-semibold tabular-nums">₹{totalRecharged.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Total charged</p>
          <p className="text-2xl font-semibold tabular-nums">₹{totalCharged.toFixed(2)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">Manual adjustment</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant={direction === "credit" ? "default" : "outline"} onClick={() => setDirection("credit")}>
                <Plus className="mr-1 h-3 w-3" /> Credit
              </Button>
              <Button size="sm" variant={direction === "debit" ? "default" : "outline"} onClick={() => setDirection("debit")}>
                <Minus className="mr-1 h-3 w-3" /> Debit
              </Button>
            </div>
            <div className="w-40">
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            </div>
            <Button onClick={() => adjust.mutate()} disabled={!amount || adjust.isPending}>
              {adjust.isPending ? "Saving…" : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-medium">Ledger (last 50)</div>
          {ledger.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No transactions</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Dir</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((l: any) => {
                  const hasInvoice =
                    (l.kind === "recharge" && l.recharge_id) ||
                    (l.kind === "admin_adjustment" && l.direction === "credit");
                  return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{format(new Date(l.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="text-xs">{l.kind}</TableCell>
                    <TableCell><Badge variant={l.direction === "credit" ? "default" : "secondary"}>{l.direction}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">₹{Number(l.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">₹{Number(l.balance_after ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{l.notes}</TableCell>
                    <TableCell>
                      {hasInvoice && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Download invoice"
                          onClick={() => {
                            if (l.kind === "recharge") {
                              const r = recharges.find((x: any) => x.id === l.recharge_id);
                              if (!r) return;
                              downloadWalletInvoice({
                                kind: "recharge", id: r.id,
                                createdAt: r.paid_at || r.created_at,
                                amount: Number(r.amount),
                                paymentMethod: r.payment_method,
                                paymentRef: r.cashfree_payment_id || r.cashfree_order_id,
                                store,
                              });
                            } else {
                              downloadWalletInvoice({
                                kind: "credit_note", id: l.id,
                                createdAt: l.created_at, amount: Number(l.amount),
                                notes: l.notes, store,
                              });
                            }
                          }}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );})}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-medium">Recharges (last 20)</div>
          {recharges.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No recharges yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recharges.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="text-right tabular-nums">₹{Number(r.amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.cashfree_order_id ?? "—"}</TableCell>
                    <TableCell>
                      {r.status === "paid" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Download invoice"
                          onClick={() => downloadWalletInvoice({
                            kind: "recharge", id: r.id,
                            createdAt: r.paid_at || r.created_at,
                            amount: Number(r.amount),
                            paymentMethod: r.payment_method,
                            paymentRef: r.cashfree_payment_id || r.cashfree_order_id,
                            store,
                          })}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Danger Panel ────────────────────────────────────────── */

function DangerPanel({ store, owner, onChanged }: any) {
  const toggleSuspend = useMutation({
    mutationFn: async (suspend: boolean) => {
      const { error } = await supabase.from("stores").update({ is_suspended: suspend }).eq("id", store.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Store updated"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleVerify = useMutation({
    mutationFn: async (verified: boolean) => {
      const { error } = await supabase.from("stores").update({ is_verified: verified }).eq("id", store.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Store updated"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleBlock = useMutation({
    mutationFn: async (block: boolean) => {
      if (!owner?.user_id) throw new Error("Owner not found");
      const { error } = await supabase.from("profiles").update({ is_blocked: block }).eq("user_id", owner.user_id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Owner updated"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Row label="Store suspension" status={store.is_suspended ? "Suspended" : "Active"} statusVariant={store.is_suspended ? "destructive" : "secondary"}>
          {store.is_suspended ? (
            <Button size="sm" variant="outline" onClick={() => toggleSuspend.mutate(false)}><CheckCircle className="mr-1 h-3 w-3" /> Activate</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => toggleSuspend.mutate(true)}><Ban className="mr-1 h-3 w-3" /> Suspend</Button>
          )}
        </Row>
        <Row label="Verification" status={store.is_verified ? "Verified" : "Unverified"} statusVariant={store.is_verified ? "default" : "outline"}>
          {store.is_verified ? (
            <Button size="sm" variant="outline" onClick={() => toggleVerify.mutate(false)}>Remove verification</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => toggleVerify.mutate(true)}><BadgeCheck className="mr-1 h-3 w-3" /> Verify</Button>
          )}
        </Row>
        <Row label="Owner account" status={owner?.is_blocked ? "Blocked" : "Active"} statusVariant={owner?.is_blocked ? "destructive" : "secondary"}>
          {owner?.is_blocked ? (
            <Button size="sm" variant="outline" onClick={() => toggleBlock.mutate(false)}><CheckCircle className="mr-1 h-3 w-3" /> Unblock owner</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => toggleBlock.mutate(true)}><Ban className="mr-1 h-3 w-3" /> Block owner</Button>
          )}
        </Row>
      </CardContent>
    </Card>
  );
}

function Row({ label, status, statusVariant, children }: any) {
  return (
    <div className="flex items-center justify-between rounded border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <Badge variant={statusVariant} className="mt-1">{status}</Badge>
      </div>
      {children}
    </div>
  );
}
