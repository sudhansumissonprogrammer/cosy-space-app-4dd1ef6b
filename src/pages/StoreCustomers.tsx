import { useState } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/dashboard/PullToRefreshIndicator";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ArrowLeft, Users, ShoppingBag, Phone, Mail, Calendar, IndianRupee } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";

export default function StoreCustomers() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const { data: store, isLoading: storeLoading } = useStoreData(storeId);

  const { pull, refreshing } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-customers-count", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-customers", storeId] }),
      ]);
    },
  });

  const { data: countData } = useQuery({
    queryKey: ["store-customers-count", storeId],
    queryFn: async () => {
      const { count, error } = await supabase.from("customers").select("*", { count: "exact", head: true }).eq("store_id", storeId!);
      if (error) throw error;
      return count;
    },
    enabled: !!storeId,
  });

  const pagination = usePagination(countData ?? undefined);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["store-customers", storeId, pagination.page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers").select("*").eq("store_id", storeId!)
        .order("order_count", { ascending: false })
        .range(pagination.from, pagination.to);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  // Fetch orders for selected customer
  const { data: customerOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["customer-orders", storeId, selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      const phone = selectedCustomer.phone;
      const email = selectedCustomer.email;
      
      // Query website orders matching by phone or email
      let query = (supabase as any).from("orders").select("*, order_items(*)").eq("store_id", storeId!);
      
      if (phone && email && !email.endsWith("@whatsapp")) {
        // Match by phone OR email
        query = query.or(`customer_phone.eq.${phone},customer_name.eq.${selectedCustomer.name}`);
      } else if (phone) {
        query = query.eq("customer_phone", phone);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCustomer && !!storeId,
  });

  const totalSpent = customerOrders?.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0) || 0;

  const currencySymbol = store?.currency === "INR" ? "₹" : store?.currency === "USD" ? "$" : (store?.currency || "$");

  // No early "Store not found" return — caused React error #300 (hook-count mismatch
  // in conditionally-mounted Sheet/Dialog children). Empty state below handles no-store.

  return (
    <div className="space-y-6">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/dashboard/stores"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">{store?.name}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : customers && customers.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Orders</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <TableCell className="font-medium text-foreground">{customer.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.email?.endsWith("@whatsapp") ? "—" : customer.email}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{customer.order_count}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(customer.created_at), "MMM d, yyyy")}</TableCell>
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
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No customers yet</p>
            <p className="text-sm text-muted-foreground">Customers are created automatically when orders are placed</p>
          </CardContent>
        </Card>
      )}

      {/* Customer Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={(v) => { if (!v) setSelectedCustomer(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selectedCustomer && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">{selectedCustomer.name || "Customer"}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-foreground">{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.email && !selectedCustomer.email.endsWith("@whatsapp") && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-foreground">{selectedCustomer.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Joined {format(new Date(selectedCustomer.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{selectedCustomer.order_count}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Orders</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{currencySymbol}{totalSpent.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Spent</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Address */}
                {selectedCustomer.address && typeof selectedCustomer.address === "object" && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Address</h4>
                    <p className="text-sm text-muted-foreground">
                      {[
                        (selectedCustomer.address as any).street_address,
                        (selectedCustomer.address as any).city,
                        (selectedCustomer.address as any).state,
                        (selectedCustomer.address as any).pincode,
                      ].filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                )}

                {/* Order History */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Order History</h4>
                  {ordersLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : customerOrders && customerOrders.length > 0 ? (
                    <div className="space-y-2">
                      {customerOrders.map((order: any) => (
                        <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-muted-foreground">{order.id.slice(0, 8)}</p>
                            <p className="text-sm font-medium text-foreground mt-0.5">
                              {currencySymbol}{Number(order.total).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), "MMM d, yyyy")}</p>
                          </div>
                          <Badge
                            variant={order.status === "delivered" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"}
                            className="shrink-0 text-[11px]"
                          >
                            {order.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-6">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No orders found</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
