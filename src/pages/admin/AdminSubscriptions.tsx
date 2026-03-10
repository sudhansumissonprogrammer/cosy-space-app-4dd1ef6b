import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CreditCard, Crown } from "lucide-react";
import { format } from "date-fns";

export default function AdminSubscriptions() {
  const queryClient = useQueryClient();

  // Plans
  const { data: plans } = useQuery({
    queryKey: ["admin-plans"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("price");
      if (error) throw error;
      return data;
    },
  });

  // Subscriptions with user + plan info
  const { data: subscriptions } = useQuery({
    queryKey: ["admin-subscriptions"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plans:plan_id(name, slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Stores for assignment
  const { data: stores } = useQuery({
    queryKey: ["admin-stores"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name, owner_id").order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-foreground">Subscription Management</h1>

      {/* Plans Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Plans</h2>
          <PlanDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-plans"] })} />
        </div>

        {plans && plans.length > 0 ? (
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
                    ${Number(plan.price).toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.product_limit ? `${plan.product_limit} products` : "Unlimited products"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <PlanDialog
                      plan={plan}
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-plans"] })}
                    />
                    <DeletePlanButton
                      planId={plan.id}
                      planName={plan.name}
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-plans"] })}
                    />
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

      {/* Subscriptions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Active Subscriptions</h2>
          {plans && stores && (
            <AssignPlanDialog
              plans={plans}
              stores={stores}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] })}
            />
          )}
        </div>

        {subscriptions && subscriptions.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {sub.user_id.slice(0, 12)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <Crown className="mr-1 h-3 w-3" />
                          {(sub.plans as any)?.name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(sub.started_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <CancelSubButton
                          subId={sub.id}
                          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex min-h-[100px] items-center justify-center">
              <CreditCard className="mr-2 h-5 w-5 text-muted-foreground" />
              <p className="text-muted-foreground">No subscriptions</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

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
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-3 w-3" /> New Plan
          </Button>
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
            <Label>Price ($/month)</Label>
            <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Product Limit (empty = unlimited)</Label>
            <Input type="number" min="1" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Unlimited" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {plan ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePlanButton({ planId, planName, onSuccess }: { planId: string; planName: string; onSuccess: () => void }) {
  const handleDelete = async () => {
    const { error } = await supabase.from("plans").delete().eq("id", planId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Plan deleted");
      onSuccess();
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{planName}"?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete this plan.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AssignPlanDialog({ plans, stores, onSuccess }: { plans: any[]; stores: any[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [planId, setPlanId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    setLoading(true);
    try {
      const store = stores.find((s) => s.id === storeId);
      if (!store) throw new Error("Store not found");

      // Upsert subscription for the store owner
      const { error } = await supabase
        .from("subscriptions")
        .upsert(
          { user_id: store.owner_id, plan_id: planId, status: "active", started_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      toast.success("Plan assigned");
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
        <Button size="sm"><Crown className="mr-1 h-3 w-3" /> Assign Plan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign Plan to Store</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Store</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.filter((p) => p.is_active).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — ${Number(p.price).toFixed(2)}/mo</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleAssign} disabled={loading || !storeId || !planId}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelSubButton({ subId, onSuccess }: { subId: string; onSuccess: () => void }) {
  const handleCancel = async () => {
    const { error } = await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subId);
    if (error) toast.error(error.message);
    else { toast.success("Subscription cancelled"); onSuccess(); }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive">Cancel</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
          <AlertDialogDescription>The user will lose access to their plan features.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Cancel Subscription
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
