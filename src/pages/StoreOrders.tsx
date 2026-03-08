import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";

const STATUS_OPTIONS = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

export default function StoreOrders() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").eq("id", storeId!).eq("owner_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  const { data: countData } = useQuery({
    queryKey: ["whatsapp-orders-count", storeId],
    queryFn: async () => {
      const { count, error } = await supabase.from("whatsapp_orders").select("*", { count: "exact", head: true }).eq("store_id", storeId!);
      if (error) throw error;
      return count;
    },
    enabled: !!storeId,
  });

  const pagination = usePagination(countData ?? undefined);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["whatsapp-orders", storeId, pagination.page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_orders").select("*").eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .range(pagination.from, pagination.to);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase.from("whatsapp_orders").update({ status }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-orders", storeId] });
      toast.success("Order status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!store && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Store not found</p>
        <Button asChild variant="outline"><Link to="/dashboard/stores">Back to stores</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/dashboard/stores"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">{store?.name}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : orders && orders.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}</TableCell>
                      <TableCell className="font-medium text-foreground">{order.product_name}</TableCell>
                      <TableCell className="text-right">${Number(order.product_price).toFixed(2)}</TableCell>
                      <TableCell className="text-center">{order.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{order.customer_phone || "—"}</TableCell>
                      <TableCell>
                        <Select value={order.status} onValueChange={(value) => updateStatus.mutate({ orderId: order.id, status: value })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(order.created_at), "MMM d, HH:mm")}</TableCell>
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
          <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No orders yet</p>
            <p className="text-sm text-muted-foreground">Orders will appear here when customers click "Order on WhatsApp"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
