import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Store, Wallet, Crown, Settings2, Plus, Minus, Ban, CheckCircle, BadgeCheck, ExternalLink,
} from "lucide-react";

type Mode = "subscription" | "commission";
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
      const [{ data: assignment }, { data: plans }, { data: payments }, { data: owner }] = await Promise.all([
        supabase.from("store_plan_assignments" as any)
          .select("*, plans:plan_id(id, name, slug, price, product_limit)")
          .eq("store_id", storeId).maybeSingle(),
        supabase.from("plans").select("*").eq("is_active", true).order("price"),
        supabase.from("subscription_payments" as any)
          .select("id, amount, status, created_at, provider, payment_id")
          .eq("store_id", storeId).order("created_at", { ascending: false }).limit(10),
        supabase.from("stores").select("owner_id").eq("id", storeId).maybeSingle(),
      ]);
      let ownerProfile: any = null;
      if (owner?.owner_id) {
        const { data: p } = await supabase.from("profiles").select("full_name, is_blocked, user_id").eq("user_id", owner.owner_id).maybeSingle();
        ownerProfile = p;
      }
      return { ...summary, assignment, plans: plans ?? [], payments: payments ?? [], ownerProfile };
    },
  });

  const store = data?.store as any;
  const wallet = data?.wallet as any;
  const config = data?.config as any;
  const ledger = (data?.ledger ?? []) as any[];
  const recharges = (data?.recharges ?? []) as any[];
  const assignment = (data as any)?.assignment;
  const plans = ((data as any)?.plans ?? []) as any[];
  const payments = ((data as any)?.payments ?? []) as any[];
  const ownerProfile = (data as any)?.ownerProfile;

  const mode: Mode = (store?.billing_mode ?? "subscription") as Mode;
  const isCommission = mode === "commission";

  const invalidateAll = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["admin-wallets"] });
    qc.invalidateQueries({ queryKey: ["admin-store-billing-modes"] });
    qc.invalidateQueries({ queryKey: ["admin-store-plan-assignments"] });
    qc.invalidateQueries({ queryKey: ["admin-users-stores"] });
  };

  const switchMode = useMutation({
    mutationFn: async (next: Mode) => callControl({ action: "set_billing_mode", store_id: storeId, mode: next }),
    onSuccess: () => { toast.success("Billing mode updated"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

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
            {/* Mode switch bar */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium">Billing Mode</Label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={!isCommission ? "default" : "outline"}
                    onClick={() => !isCommission || switchMode.mutate("subscription")}
                    disabled={!isCommission || switchMode.isPending}
                  >
                    <Crown className="mr-1 h-3 w-3" /> Subscription
                  </Button>
                  <Button
                    size="sm"
                    variant={isCommission ? "default" : "outline"}
                    onClick={() => isCommission || switchMode.mutate("commission")}
                    disabled={isCommission || switchMode.isPending}
                  >
                    <Wallet className="mr-1 h-3 w-3" /> Commission
                  </Button>
                </div>
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
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="wallet" disabled={!isCommission}>Wallet</TabsTrigger>
                <TabsTrigger value="danger">Danger</TabsTrigger>
              </TabsList>

              {/* OVERVIEW */}
              <TabsContent value="overview">
                <OverviewTab store={store} owner={ownerProfile} mode={mode} wallet={wallet} config={config} assignment={assignment} />
              </TabsContent>

              {/* BILLING */}
              <TabsContent value="billing">
                {isCommission ? (
                  <CommissionConfigPanel storeId={storeId!} config={config} onSaved={invalidateAll} />
                ) : (
                  <SubscriptionPanel
                    storeId={storeId!}
                    assignment={assignment}
                    plans={plans}
                    payments={payments}
                    onSaved={invalidateAll}
                  />
                )}
              </TabsContent>

              {/* WALLET */}
              <TabsContent value="wallet">
                {isCommission ? (
                  <WalletPanel
                    storeId={storeId!}
                    wallet={wallet}
                    ledger={ledger}
                    recharges={recharges}
                    onSaved={invalidateAll}
                  />
                ) : (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">Switch to Commission mode to manage wallet.</CardContent></Card>
                )}
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

function OverviewTab({ store, owner, mode, wallet, config, assignment }: any) {
  const stats = [
    { label: "Mode", value: mode === "commission" ? "Commission" : "Subscription" },
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
          {mode === "commission" ? (
            <>
              <p><span className="text-muted-foreground">Wallet balance:</span> ₹{Number(wallet?.balance ?? 0).toFixed(2)}</p>
              <p><span className="text-muted-foreground">Commission %:</span> {config?.commission_percentage ?? 3}%</p>
            </>
          ) : (
            <>
              <p><span className="text-muted-foreground">Plan:</span> {assignment?.custom_plan_name || assignment?.plans?.name || "—"}</p>
              <p><span className="text-muted-foreground">Status:</span> {assignment?.billing_status || "—"}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Subscription Panel ──────────────────────────────────── */

function SubscriptionPanel({ storeId, assignment, plans, payments, onSaved }: any) {
  const hasAssignment = !!assignment?.id;
  const [planId, setPlanId] = useState(assignment?.plan_id || plans[0]?.id || "");
  const [customPlanName, setCustomPlanName] = useState(assignment?.custom_plan_name || "");
  const [customPrice, setCustomPrice] = useState(assignment?.custom_price?.toString() || "");
  const [customLimit, setCustomLimit] = useState(assignment?.custom_product_limit?.toString() || "");
  const [isFreeLifetime, setIsFreeLifetime] = useState(!!assignment?.is_free_lifetime);
  const [isOneTime, setIsOneTime] = useState(!!assignment?.is_one_time);
  const [billingStatus, setBillingStatus] = useState(assignment?.billing_status || "active");
  const [trialEnds, setTrialEnds] = useState(toLocal(assignment?.trial_ends_at));
  const [periodEnd, setPeriodEnd] = useState(toLocal(assignment?.current_period_end));
  const [graceEnd, setGraceEnd] = useState(toLocal(assignment?.grace_period_ends_at));
  const [notes, setNotes] = useState(assignment?.notes || "");

  useEffect(() => {
    setPlanId(assignment?.plan_id || plans[0]?.id || "");
    setCustomPlanName(assignment?.custom_plan_name || "");
    setCustomPrice(assignment?.custom_price?.toString() || "");
    setCustomLimit(assignment?.custom_product_limit?.toString() || "");
    setIsFreeLifetime(!!assignment?.is_free_lifetime);
    setIsOneTime(!!assignment?.is_one_time);
    setBillingStatus(assignment?.billing_status || "active");
    setTrialEnds(toLocal(assignment?.trial_ends_at));
    setPeriodEnd(toLocal(assignment?.current_period_end));
    setGraceEnd(toLocal(assignment?.grace_period_ends_at));
    setNotes(assignment?.notes || "");
  }, [assignment?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        store_id: storeId,
        plan_id: planId,
        custom_plan_name: customPlanName.trim() || null,
        custom_price: customPrice === "" ? null : Number(customPrice),
        custom_product_limit: customLimit === "" ? null : parseInt(customLimit),
        is_free_lifetime: isFreeLifetime,
        is_one_time: isOneTime,
        billing_status: isFreeLifetime ? "lifetime" : isOneTime ? "one_time_paid" : billingStatus,
        trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
        grace_period_ends_at: graceEnd ? new Date(graceEnd).toISOString() : null,
        notes: notes.trim() || null,
        status: "active",
      };
      const q = hasAssignment
        ? supabase.from("store_plan_assignments" as any).update(payload).eq("id", assignment.id)
        : supabase.from("store_plan_assignments" as any).insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subscription updated"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toFixed(0)}/mo</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={billingStatus} onValueChange={setBillingStatus} disabled={isFreeLifetime || isOneTime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["trialing","active","past_due","suspended","cancelled","lifetime","one_time_paid"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Custom plan name</Label>
              <Input value={customPlanName} onChange={(e) => setCustomPlanName(e.target.value)} placeholder="(optional)" maxLength={80} />
            </div>
            <div>
              <Label>Custom price (₹/mo)</Label>
              <Input type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Plan default" />
            </div>
            <div>
              <Label>Custom product limit</Label>
              <Input type="number" value={customLimit} onChange={(e) => setCustomLimit(e.target.value)} placeholder="Plan default" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded border p-2">
                <Label>Free lifetime</Label>
                <Switch checked={isFreeLifetime} onCheckedChange={(v) => { setIsFreeLifetime(v); if (v) setIsOneTime(false); }} />
              </div>
              <div className="flex items-center justify-between rounded border p-2">
                <Label>One-time</Label>
                <Switch checked={isOneTime} onCheckedChange={(v) => { setIsOneTime(v); if (v) setIsFreeLifetime(false); }} />
              </div>
            </div>
            <div>
              <Label>Trial ends</Label>
              <Input type="datetime-local" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
            </div>
            <div>
              <Label>Period end</Label>
              <Input type="datetime-local" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div>
              <Label>Grace ends</Label>
              <Input type="datetime-local" value={graceEnd} onChange={(e) => setGraceEnd(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Admin notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !planId}>
              {save.isPending ? "Saving…" : "Save subscription"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-medium">Recent payments</div>
          {payments.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No payments yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{format(new Date(p.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.provider || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">₹{Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
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

function toLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ── Commission Config Panel ─────────────────────────────── */

function CommissionConfigPanel({ storeId, config, onSaved }: any) {
  const [pct, setPct] = useState(String(config?.commission_percentage ?? 3));
  const [minR, setMinR] = useState(String(config?.min_recharge ?? 700));
  const [low, setLow] = useState(String(config?.low_balance_threshold ?? 100));

  useEffect(() => {
    setPct(String(config?.commission_percentage ?? 3));
    setMinR(String(config?.min_recharge ?? 700));
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

function WalletPanel({ storeId, wallet, ledger, recharges, onSaved }: any) {
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{format(new Date(l.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="text-xs">{l.kind}</TableCell>
                    <TableCell><Badge variant={l.direction === "credit" ? "default" : "secondary"}>{l.direction}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">₹{Number(l.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">₹{Number(l.balance_after ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{l.notes}</TableCell>
                  </TableRow>
                ))}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {recharges.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="text-right tabular-nums">₹{Number(r.amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.cashfree_order_id ?? "—"}</TableCell>
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
