import { useState } from "react";
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
import { Store, Ban, CheckCircle, Trash2, Search, BadgeCheck } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import { TableSkeleton } from "@/components/admin/AdminSkeletons";

export default function AdminStores() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: countData } = useQuery({
    queryKey: ["admin-stores-count"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase.from("stores").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count;
    },
  });

  const pagination = usePagination(countData ?? undefined);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-stores", pagination.page],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, owner_id, name, slug, logo_url, is_suspended, is_verified, created_at")
        .order("created_at", { ascending: false })
        .range(pagination.from, pagination.to);
      if (error) throw error;
      return data;
    },
  });

  const toggleSuspend = useMutation({
    mutationFn: async ({ storeId, suspend }: { storeId: string; suspend: boolean }) => {
      const { error } = await supabase.from("stores").update({ is_suspended: suspend }).eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      toast.success("Store verification updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteStore = useMutation({
    mutationFn: async (storeId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-store", {
        body: { storeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stores-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(`Store deleted — ${data?.results?.storage_files_deleted ?? 0} files cleaned up`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = stores?.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">All Stores</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search stores..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" maxLength={100} />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton columns={7} rows={6} />
      ) : filtered && filtered.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Store</TableHead>
                     <TableHead>Slug</TableHead>
                     <TableHead>Owner ID</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Verified</TableHead>
                     <TableHead>Created</TableHead>
                     <TableHead className="w-48"></TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>
                  {filtered.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {store.logo_url ? (
                            <img src={store.logo_url} alt="" className="h-8 w-8 rounded border object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-accent"><Store className="h-4 w-4 text-muted-foreground" /></div>
                          )}
                          <span className="font-medium text-foreground">{store.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">/store/{store.slug}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{store.owner_id.slice(0, 12)}...</TableCell>
                      <TableCell>
                        <Badge variant={store.is_suspended ? "destructive" : "secondary"}>{store.is_suspended ? "Suspended" : "Active"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(store.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge
                          variant={(store as any).is_verified ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleVerify.mutate({ storeId: store.id, verified: !(store as any).is_verified })}
                        >
                          {(store as any).is_verified ? <><BadgeCheck className="mr-1 h-3 w-3" /> Verified</> : "Unverified"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {store.is_suspended ? (
                            <Button variant="outline" size="sm" onClick={() => toggleSuspend.mutate({ storeId: store.id, suspend: false })}>
                              <CheckCircle className="mr-1 h-3 w-3" /> Activate
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Ban className="mr-1 h-3 w-3" /> Suspend</Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Suspend "{store.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>This store will be hidden from the public.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => toggleSuspend.mutate({ storeId: store.id, suspend: true })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Suspend</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{store.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete this store and all its data.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteStore.mutate(store.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <PaginationControls page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} />
        </>
      ) : (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center">
            <Store className="mr-2 h-5 w-5 text-muted-foreground" />
            <p className="text-muted-foreground">{search ? "No stores match your search" : "No stores found"}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
