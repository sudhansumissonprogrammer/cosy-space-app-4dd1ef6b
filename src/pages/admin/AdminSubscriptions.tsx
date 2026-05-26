import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Crown, Store, Settings2, Search } from "lucide-react";
import ManageStoreDialog from "@/components/admin/ManageStoreDialog";

export default function AdminSubscriptions() {
  useDocumentTitle("Subscriptions · Admin");
  const queryClient = useQueryClient();

  const { data: plans } = useQuery({
    queryKey: ["admin-plans"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("price");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Subscription Management</h1>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans"><Crown className="mr-1 h-3 w-3" /> Global Plans</TabsTrigger>
          <TabsTrigger value="stores"><Store className="mr-1 h-3 w-3" /> Store Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <GlobalPlansSection plans={plans || []} queryClient={queryClient} />
        </TabsContent>

        <TabsContent value="stores">
          <StorePlansSection plans={plans || []} queryClient={queryClient} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Global Plans ──

function GlobalPlansSection({ plans, queryClient }: { plans: any[]; queryClient: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Global Plans</h2>
        <PlanDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-plans"] })} />
      </div>

      {plans.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  ₹{Number(plan.price).toFixed(0)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.product_limit ? `${plan.product_limit} products` : "Unlimited products"}
                </p>
                <div className="mt-3 flex gap-2">
                  <PlanDialog plan={plan} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-plans"] })} />
                  <DeletePlanButton planId={plan.id} planName={plan.name} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-plans"] })} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-[100px] items-center justify-center">
            <p className="text-muted-foreground">No plans configured</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Store Plans ──

function StorePlansSection({ plans, queryClient }: { plans: any[]; queryClient: any }) {
  const [search, setSearch] = useState("");
  const [manageId, setManageId] = useState<string | null>(null);

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ["admin-stores-for-plan-assignments"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, logo_url, billing_mode")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: storeAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["admin-store-plan-assignments"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plan_assignments" as any)
        .select("*, stores:store_id(id, name, slug, logo_url), plans:plan_id(id, name, slug, price, product_limit)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const combinedAssignments = useMemo(() => {
    const assignmentMap = new Map((storeAssignments || []).map((assignment: any) => [assignment.store_id, assignment]));

    return (stores || []).map((store: any) => {
      const assignment = assignmentMap.get(store.id);
      if (assignment) return assignment;

      return {
        id: `unassigned-${store.id}`,
        store_id: store.id,
        plan_id: "",
        custom_plan_name: null,
        custom_price: null,
        custom_product_limit: null,
        is_free_lifetime: false,
        is_one_time: false,
        notes: null,
        status: "unassigned",
        stores: store,
        plans: null,
        is_unassigned: true,
      };
    });
  }, [storeAssignments, stores]);

  const filtered = combinedAssignments.filter((a: any) => {
    if (!search) return true;
    const storeName = (a.stores as any)?.name?.toLowerCase() || "";
    return storeName.includes(search.toLowerCase());
  });




  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-foreground">Store Plan Assignments</h2>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search stores..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      {storesLoading || assignmentsLoading ? (
        <Card><CardContent className="flex min-h-[100px] items-center justify-center"><p className="text-muted-foreground">Loading...</p></CardContent></Card>
      ) : filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Current Plan</TableHead>
                  <TableHead>Override</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((assignment: any) => {
                  const store = assignment.stores as any;
                  const plan = assignment.plans as any;
                  const isCommission = store?.billing_mode === "commission";
                  const hasOverride = assignment.custom_plan_name || assignment.is_free_lifetime || assignment.is_one_time || assignment.custom_price != null || assignment.custom_product_limit != null;

                  return (
                    <TableRow key={assignment.id} className={isCommission ? "bg-muted/30" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {store?.logo_url ? (
                            <img src={store.logo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                              <Store className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">{store?.name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{store?.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      {isCommission ? (
                        <>
                          <TableCell colSpan={3}>
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-primary/15 text-primary hover:bg-primary/20">
                                Commission billing
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Managed in <a href="/admin/wallets" className="underline">Commission Wallets</a> — subscription overrides do not apply.
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">parked</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="default" onClick={() => setManageId(assignment.store_id)}>
                              <Settings2 className="mr-1 h-3 w-3" /> Manage
                            </Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Badge variant="outline">
                              <Crown className="mr-1 h-3 w-3" />
                              {assignment.custom_plan_name || plan?.name || "No plan assigned"}
                            </Badge>
                            {assignment.custom_plan_name && (
                              <span className="ml-1 text-xs text-muted-foreground">(custom)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasOverride ? (
                              <div className="flex flex-wrap gap-1">
                                {assignment.is_free_lifetime && <Badge variant="secondary" className="text-xs">Free Lifetime</Badge>}
                                {assignment.is_one_time && <Badge variant="secondary" className="text-xs">One-time</Badge>}
                                {assignment.custom_price != null && <Badge variant="secondary" className="text-xs">₹{assignment.custom_price}/mo</Badge>}
                                {assignment.custom_product_limit != null && <Badge variant="secondary" className="text-xs">{assignment.custom_product_limit} products</Badge>}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Global defaults</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <BillingCell assignment={assignment} />
                          </TableCell>
                          <TableCell>
                            <Badge variant={assignment.billing_status === "active" || assignment.billing_status === "lifetime" || assignment.billing_status === "one_time_paid" ? "default" : "secondary"}>
                              {assignment.is_free_lifetime
                                ? "lifetime"
                                : assignment.is_one_time
                                  ? "one-time"
                                  : assignment.billing_status === "lifetime"
                                    ? "active" /* legacy data fix: show monthly plans as active */
                                    : (assignment.billing_status || assignment.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="default" onClick={() => setManageId(assignment.store_id)}>
                              <Settings2 className="mr-1 h-3 w-3" /> Manage
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex min-h-[100px] items-center justify-center">
            <Store className="mr-2 h-5 w-5 text-muted-foreground" />
            <p className="text-muted-foreground">No stores found</p>
          </CardContent>
        </Card>
      )}

      <ManageStoreDialog
        storeId={manageId}
        open={!!manageId}
        onOpenChange={(o) => { if (!o) setManageId(null); }}
        defaultTab="billing"
      />
    </div>
  );
}

// StoreOverrideDialog removed — superseded by ManageStoreDialog → Billing tab.

// ── Plan CRUD Dialogs ──

function PlanDialog({ plan, onSuccess }: { plan?: any; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(plan?.name || "");
  const [price, setPrice] = useState(plan?.price?.toString() || "0");
  const [limit, setLimit] = useState(plan?.product_limit?.toString() || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/\s+/g, "-"),
        price: parseFloat(price),
        product_limit: limit ? parseInt(limit) : null,
      };

      if (plan) {
        const { error } = await supabase.from("plans").update(payload).eq("id", plan.id);
        if (error) throw error;
        toast.success("Plan updated");
      } else {
        const { error } = await supabase.from("plans").insert(payload);
        if (error) throw error;
        toast.success("Plan created");
      }
      onSuccess();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan ? (
          <Button variant="outline" size="sm"><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
        ) : (
          <Button size="sm"><Plus className="mr-1 h-3 w-3" /> New Plan</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? "Edit Plan" : "Create Plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name" />
          </div>
          <div className="space-y-2">
            <Label>Price (₹/month)</Label>
            <Input type="number" step="1" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Product Limit (empty = unlimited)</Label>
            <Input type="number" min="1" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Unlimited" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>{plan ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePlanButton({ planId, planName, onSuccess }: { planId: string; planName: string; onSuccess: () => void }) {
  const handleDelete = async () => {
    const { error } = await supabase.from("plans").delete().eq("id", planId);
    if (error) toast.error(error.message);
    else { toast.success("Plan deleted"); onSuccess(); }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{planName}"?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete this plan and remove it from all stores.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BillingCell({ assignment }: { assignment: any }) {
  if (assignment.is_unassigned) return <span className="text-xs text-muted-foreground">—</span>;
  if (assignment.is_free_lifetime) return <span className="text-xs text-muted-foreground">Lifetime</span>;
  if (assignment.is_one_time) return <span className="text-xs text-muted-foreground">One-time</span>;

  const status = assignment.billing_status;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";

  if (status === "trialing" && assignment.trial_ends_at) {
    return (
      <div className="text-xs">
        <div className="text-amber-600">Trial</div>
        <div className="text-muted-foreground">ends {fmt(assignment.trial_ends_at)}</div>
      </div>
    );
  }
  if (status === "active" && assignment.current_period_end) {
    return (
      <div className="text-xs">
        <div className="text-green-600">Active</div>
        <div className="text-muted-foreground">renews {fmt(assignment.current_period_end)}</div>
      </div>
    );
  }
  if (status === "past_due") {
    return (
      <div className="text-xs">
        <div className="text-destructive">Past due</div>
        <div className="text-muted-foreground">grace {fmt(assignment.grace_period_ends_at)}</div>
      </div>
    );
  }
  if (status === "suspended") {
    return <div className="text-xs text-destructive">Suspended</div>;
  }
  return <span className="text-xs text-muted-foreground">{status || "—"}</span>;
}
// BillingActions removed — quick +30d / force-suspend now live in ManageStoreDialog.
