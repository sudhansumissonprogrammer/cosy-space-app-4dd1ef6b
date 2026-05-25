import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Store, Ban, CheckCircle, Trash2, Search, BadgeCheck, Users, ExternalLink, Wallet } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/admin/AdminSkeletons";
import ManageStoreDialog from "@/components/admin/ManageStoreDialog";
import { Settings2 } from "lucide-react";

interface UserStoreRow {
  user_id: string;
  email: string;
  user_created_at: string;
  full_name: string | null;
  is_blocked: boolean;
  store_id: string | null;
  store_name: string | null;
  store_slug: string | null;
  store_logo: string | null;
  is_suspended: boolean;
  is_verified: boolean;
  store_created_at: string | null;
  product_count: number;
  order_count: number;
  billing_mode?: string | null;
}

export default function AdminUsersStores() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [manageStoreId, setManageStoreId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-users-stores"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_users_stores");
      if (error) throw error;
      return data as unknown as UserStoreRow[];
    },
  });

  const toggleBlock = useMutation({
    mutationFn: async ({ userId, block }: { userId: string; block: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_blocked: block }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("User updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleSuspend = useMutation({
    mutationFn: async ({ storeId, suspend }: { storeId: string; suspend: boolean }) => {
      const { error } = await supabase.from("stores").update({ is_suspended: suspend }).eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Store updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleVerify = useMutation({
    mutationFn: async ({ storeId, verified }: { storeId: string; verified: boolean }) => {
      const { error } = await (supabase as any).from("stores").update({ is_verified: verified }).eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-stores"] });
      toast.success("Verification updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Map of store_id → billing_mode (since RPC may not return it). Fetched once.
  const { data: billingModes } = useQuery({
    queryKey: ["admin-store-billing-modes"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, billing_mode");
      const m = new Map<string, string>();
      (data ?? []).forEach((r: any) => m.set(r.id, r.billing_mode ?? "subscription"));
      return m;
    },
  });

  const setBillingMode = useMutation({
    mutationFn: async ({ storeId, mode }: { storeId: string; mode: "subscription" | "commission" }) => {
      const { data, error } = await supabase.functions.invoke("admin-wallet-controls", {
        body: { action: "set_billing_mode", store_id: storeId, mode },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-store-billing-modes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
      toast.success("Billing mode updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteStore = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await supabase.from("stores").delete().eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Store deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = rows?.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.email?.toLowerCase().includes(q) ||
      r.full_name?.toLowerCase().includes(q) ||
      r.store_name?.toLowerCase().includes(q) ||
      r.store_slug?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Users & Stores</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or store..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            maxLength={100}
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton columns={9} rows={6} />
      ) : filtered && filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-center">Products</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-48"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.user_id}>
                    {/* User column */}
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{row.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </div>
                    </TableCell>

                    {/* Store column */}
                    <TableCell>
                      {row.store_id ? (
                        <div className="flex items-center gap-2">
                          {row.store_logo ? (
                            <img src={row.store_logo} alt="" className="h-8 w-8 rounded border object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-accent">
                              <Store className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground">{row.store_name}</p>
                            <p className="text-xs text-muted-foreground">/{row.store_slug}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No store created</span>
                      )}
                    </TableCell>

                    {/* Products */}
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {row.store_id ? row.product_count : "—"}
                    </TableCell>

                    {/* Orders */}
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {row.store_id ? row.order_count : "—"}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {row.is_blocked && <Badge variant="destructive">Blocked</Badge>}
                        {row.is_suspended && <Badge variant="destructive">Suspended</Badge>}
                        {!row.is_blocked && !row.is_suspended && <Badge variant="secondary">Active</Badge>}
                      </div>
                    </TableCell>

                    {/* Verified */}
                    <TableCell>
                      {row.store_id ? (
                        <Badge
                          variant={row.is_verified ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleVerify.mutate({ storeId: row.store_id!, verified: !row.is_verified })}
                        >
                          {row.is_verified ? <><BadgeCheck className="mr-1 h-3 w-3" /> Yes</> : "No"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Billing mode */}
                    <TableCell>
                      {row.store_id ? (() => {
                        const mode = billingModes?.get(row.store_id!) ?? "subscription";
                        const isCommission = mode === "commission";
                        return (
                          <Badge
                            variant={isCommission ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setBillingMode.mutate({
                              storeId: row.store_id!,
                              mode: isCommission ? "subscription" : "commission",
                            })}
                            title="Click to toggle billing mode"
                          >
                            {isCommission ? <><Wallet className="mr-1 h-3 w-3" /> Commission</> : "Subscription"}
                          </Badge>
                        );
                      })() : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Joined */}
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(row.user_created_at), "MMM d, yyyy")}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex gap-1">
                        {/* Open store dashboard */}
                        {row.store_id && row.store_slug && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/dashboard/stores/${row.store_slug}/products`)}
                            title="Open store dashboard"
                          >
                            <ExternalLink className="mr-1 h-3 w-3" /> Dashboard
                          </Button>
                        )}

                        {/* Block/Unblock user */}
                        {row.is_blocked ? (
                          <Button variant="outline" size="sm" onClick={() => toggleBlock.mutate({ userId: row.user_id, block: false })}>
                            <CheckCircle className="mr-1 h-3 w-3" /> Unblock
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => toggleBlock.mutate({ userId: row.user_id, block: true })}>
                            <Ban className="mr-1 h-3 w-3" /> Block
                          </Button>
                        )}

                        {/* Suspend/Activate store */}
                        {row.store_id && (
                          row.is_suspended ? (
                            <Button variant="outline" size="sm" onClick={() => toggleSuspend.mutate({ storeId: row.store_id!, suspend: false })}>
                              <CheckCircle className="mr-1 h-3 w-3" /> Activate
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm"><Ban className="mr-1 h-3 w-3" /> Suspend</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Suspend "{row.store_name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>This store will be hidden from the public.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => toggleSuspend.mutate({ storeId: row.store_id!, suspend: true })}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Suspend
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )
                        )}

                        {/* Delete store */}
                        {row.store_id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{row.store_name}"?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete this store and all its data.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteStore.mutate(row.store_id!)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center">
            <Users className="mr-2 h-5 w-5 text-muted-foreground" />
            <p className="text-muted-foreground">{search ? "No results match your search" : "No users found"}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
