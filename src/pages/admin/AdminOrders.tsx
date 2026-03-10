import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";

export default function AdminOrders() {
  // WhatsApp orders
  const { data: waCount } = useQuery({
    queryKey: ["admin-wa-orders-count"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase.from("whatsapp_orders").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count;
    },
  });
  const waPag = usePagination(waCount ?? undefined);
  const { data: waOrders, isLoading: waLoading } = useQuery({
    queryKey: ["admin-wa-orders", waPag.page],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_orders")
        .select("*, stores:store_id(name)")
        .order("created_at", { ascending: false })
        .range(waPag.from, waPag.to);
      if (error) throw error;
      return data;
    },
  });

  // Website orders
  const { data: webCount } = useQuery({
    queryKey: ["admin-web-orders-count"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase.from("orders").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count;
    },
  });
  const webPag = usePagination(webCount ?? undefined);
  const { data: webOrders, isLoading: webLoading } = useQuery({
    queryKey: ["admin-web-orders", webPag.page],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("*, stores:store_id(name)")
        .order("created_at", { ascending: false })
        .range(webPag.from, webPag.to);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">All Orders</h1>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp Orders</TabsTrigger>
          <TabsTrigger value="website">Website Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          {waLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : waOrders && waOrders.length > 0 ? (
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
                      {waOrders.map((order) => (
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
              <PaginationControls page={waPag.page} totalPages={waPag.totalPages} onPageChange={waPag.setPage} />
            </>
          ) : (
            <Card>
              <CardContent className="flex min-h-[200px] items-center justify-center">
                <ShoppingBag className="mr-2 h-5 w-5 text-muted-foreground" />
                <p className="text-muted-foreground">No WhatsApp orders found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="website" className="space-y-4">
          {webLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : webOrders && webOrders.length > 0 ? (
            <>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webOrders.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm text-foreground">{order.stores?.name || "—"}</TableCell>
                          <TableCell className="font-medium text-foreground">{order.customer_name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{order.customer_phone || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}
                          </TableCell>
                          <TableCell className="text-right">{order.currency} {Number(order.total).toFixed(2)}</TableCell>
                          <TableCell className="text-xs uppercase">{order.payment_method || "cod"}</TableCell>
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
              <PaginationControls page={webPag.page} totalPages={webPag.totalPages} onPageChange={webPag.setPage} />
            </>
          ) : (
            <Card>
              <CardContent className="flex min-h-[200px] items-center justify-center">
                <ShoppingBag className="mr-2 h-5 w-5 text-muted-foreground" />
                <p className="text-muted-foreground">No website orders found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
