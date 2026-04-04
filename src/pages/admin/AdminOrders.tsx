import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, ChevronRight, Phone, MapPin, CreditCard, Package, Copy, Truck } from "lucide-react";
import { TableSkeleton } from "@/components/admin/AdminSkeletons";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusColor = (status: string) => {
  switch (status) {
    case "confirmed": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "shipped": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "delivered": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function AdminOrders() {
  const isMobile = useIsMobile();
  const [mobileDetailOrder, setMobileDetailOrder] = useState<any>(null);
  const [detailType, setDetailType] = useState<"wa" | "web">("wa");

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
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("*, stores:store_id(name), order_items(*, products:product_id(image_url))")
        .order("created_at", { ascending: false })
        .range(webPag.from, webPag.to);
      if (error) throw error;
      return data as any[];
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">All Orders</h1>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp Orders</TabsTrigger>
          <TabsTrigger value="website">Website Orders</TabsTrigger>
        </TabsList>

        {/* ═══ WhatsApp Orders Tab ═══ */}
        <TabsContent value="whatsapp" className="space-y-4">
          {waLoading ? (
            <TableSkeleton columns={7} rows={5} />
          ) : waOrders && waOrders.length > 0 ? (
            <>
              {isMobile ? (
                <div className="space-y-2">
                  {waOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => { setMobileDetailOrder(order); setDetailType("wa"); }}
                      className="w-full text-left rounded-xl border bg-card p-3.5 active:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-semibold text-foreground">#{order.id.slice(0, 8)}</span>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", statusColor(order.status))}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{order.product_name}</p>
                          <p className="text-xs text-muted-foreground">{(order.stores as any)?.name || "—"}</p>
                        </div>
                        <p className="text-sm font-bold text-foreground shrink-0">₹{Number(order.product_price).toFixed(0)}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{format(new Date(order.created_at), "MMM d, yyyy · h:mm a")}</p>
                    </button>
                  ))}
                </div>
              ) : (
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
                            <TableCell className="text-right">₹{Number(order.product_price).toFixed(2)}</TableCell>
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
              )}
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

        {/* ═══ Website Orders Tab ═══ */}
        <TabsContent value="website" className="space-y-4">
          {webLoading ? (
            <TableSkeleton columns={9} rows={5} />
          ) : webOrders && webOrders.length > 0 ? (
            <>
              {isMobile ? (
                <div className="space-y-2">
                  {webOrders.map((order: any) => {
                    const displayId = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8)}`;
                    return (
                      <button
                        key={order.id}
                        onClick={() => { setMobileDetailOrder(order); setDetailType("web"); }}
                        className="w-full text-left rounded-xl border bg-card p-3.5 active:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs font-semibold text-foreground">{displayId}</span>
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", statusColor(order.status))}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{order.customer_name || "Guest"}</p>
                            <p className="text-xs text-muted-foreground">{order.stores?.name || "—"}</p>
                          </div>
                          <p className="text-sm font-bold text-foreground shrink-0">{order.currency} {Number(order.total).toFixed(0)}</p>
                        </div>
                        {order.order_items && order.order_items.length > 0 && (
                          <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-1">
                            {order.order_items.map((i: any) => i.product_name).join(", ")}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">{format(new Date(order.created_at), "MMM d, yyyy · h:mm a")}</p>
                      </button>
                    );
                  })}
                </div>
              ) : (
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
                            <TableCell className="font-mono text-xs text-muted-foreground">{order.order_number ? `#${1000 + order.order_number}` : order.id.slice(0, 8)}</TableCell>
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
              )}
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

      {/* ── MOBILE ORDER DETAIL SHEET ── */}
      <Sheet open={!!mobileDetailOrder} onOpenChange={(v) => { if (!v) setMobileDetailOrder(null); }}>
        <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl px-0 overflow-hidden flex flex-col">
          {mobileDetailOrder && detailType === "wa" && (
            <AdminWaOrderDetail order={mobileDetailOrder} onCopy={copyToClipboard} />
          )}
          {mobileDetailOrder && detailType === "web" && (
            <AdminWebOrderDetail order={mobileDetailOrder} onCopy={copyToClipboard} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── WhatsApp Order Detail ── */
function AdminWaOrderDetail({ order, onCopy }: { order: any; onCopy: (t: string) => void }) {
  return (
    <>
      <SheetHeader className="px-4 pb-3 border-b">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-lg font-bold">Order #{order.id.slice(0, 8)}</SheetTitle>
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", statusColor(order.status))}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">{format(new Date(order.created_at), "MMM d, yyyy · h:mm a")}</p>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Store</h3>
          <p className="text-sm font-medium text-foreground">{(order.stores as any)?.name || "—"}</p>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer</h3>
          <div className="space-y-2">
            {order.customer_name && <p className="text-sm font-semibold text-foreground">{order.customer_name}</p>}
            {order.customer_phone && (
              <button onClick={() => onCopy(order.customer_phone)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Phone className="h-3.5 w-3.5" />
                {order.customer_phone}
                <Copy className="h-3 w-3 ml-0.5" />
              </button>
            )}
          </div>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Product</h3>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {order.product_image_url ? (
                <img src={order.product_image_url} alt={order.product_name} className="h-14 w-14 rounded-lg object-cover shrink-0 border" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{order.product_name}</p>
                <p className="text-xs text-muted-foreground">Qty: {order.quantity}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground shrink-0">₹{Number(order.product_price).toFixed(0)}</p>
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">₹{(Number(order.product_price) * order.quantity).toFixed(0)}</span>
          </div>
        </section>
      </div>
    </>
  );
}

/* ── Website Order Detail ── */
function AdminWebOrderDetail({ order, onCopy }: { order: any; onCopy: (t: string) => void }) {
  const items = order.order_items || [];
  const displayId = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8)}`;
  const address = [order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ");

  return (
    <>
      <SheetHeader className="px-4 pb-3 border-b">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-lg font-bold">Order {displayId}</SheetTitle>
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", statusColor(order.status))}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">{format(new Date(order.created_at), "MMM d, yyyy · h:mm a")}</p>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Store</h3>
          <p className="text-sm font-medium text-foreground">{order.stores?.name || "—"}</p>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{(order.customer_name || "G")[0].toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{order.customer_name || "Guest"}</p>
                {order.customer_phone && (
                  <button onClick={() => onCopy(order.customer_phone)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <Phone className="h-3 w-3" />
                    {order.customer_phone}
                    <Copy className="h-2.5 w-2.5 ml-0.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {address && (
          <>
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delivery Address</h3>
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-foreground leading-relaxed">{address}</p>
              </div>
            </section>
          </>
        )}

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items ({items.length})</h3>
          <div className="space-y-2.5">
            {items.map((item: any, idx: number) => (
              <div key={item.id || idx} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {order.currency} {Number(item.unit_price).toFixed(0)}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground shrink-0">{order.currency} {Number(item.total).toFixed(0)}</p>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">{order.currency} {Number(order.total).toFixed(0)}</span>
          </div>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment & Shipping</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground capitalize">{order.payment_method || "COD"}</span>
            </div>
            {order.tracking_number && (
              <div className="flex items-center gap-2.5">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{order.tracking_number}</span>
                <button onClick={() => onCopy(order.tracking_number)} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
            {order.tracking_url && (
              <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                Track shipment →
              </a>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
