import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Store, Ban, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function AdminStores() {
  const queryClient = useQueryClient();

  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleSuspend = useMutation({
    mutationFn: async ({ storeId, suspend }: { storeId: string; suspend: boolean }) => {
      const { error } = await supabase
        .from("stores")
        .update({ is_suspended: suspend })
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Store updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">All Stores</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : stores && stores.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Owner ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {store.logo_url ? (
                          <img src={store.logo_url} alt="" className="h-8 w-8 rounded border object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent">
                            <Store className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium text-foreground">{store.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">/store/{store.slug}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {store.owner_id.slice(0, 12)}...
                    </TableCell>
                    <TableCell>
                      {store.is_suspended ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(store.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {store.is_suspended ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            toggleSuspend.mutate({ storeId: store.id, suspend: false })
                          }
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Activate
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Ban className="mr-1 h-3 w-3" />
                              Suspend
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Suspend "{store.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This store will be hidden from the public storefront. The owner will
                                still be able to access their dashboard.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  toggleSuspend.mutate({ storeId: store.id, suspend: true })
                                }
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Suspend
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
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
            <Store className="mr-2 h-5 w-5 text-muted-foreground" />
            <p className="text-muted-foreground">No stores found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
