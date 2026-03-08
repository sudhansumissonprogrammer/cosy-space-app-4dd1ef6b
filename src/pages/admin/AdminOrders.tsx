import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";

export default function AdminOrders() {
  const { data: countData } = useQuery({
    queryKey: ["admin-orders-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("whatsapp_orders").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count;
    },
  });

  const pagination = usePagination(countData ?? undefined);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders", pagination.page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_orders")
        .select("*, stores:store_id(name)")
        .order("created_at", { ascending: false })
        .range(pagination.from, pagination.to);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">All Orders</h1>

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
                    <TableHead>Store</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm text-foreground">{(order.stores as any)?.name || "—"}</TableCell>
                      <TableCell className="font-medium text-foreground">{order.product_name}</TableCell>
                      <TableCell className="text-right">${Number(order.product_price).toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.customer_phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === "delivered" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"}>
                          {order.status}
                        </Badge>
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
          <CardContent className="flex min-h-[200px] items-center justify-center">
            <ShoppingBag className="mr-2 h-5 w-5 text-muted-foreground" />
            <p className="text-muted-foreground">No orders found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
