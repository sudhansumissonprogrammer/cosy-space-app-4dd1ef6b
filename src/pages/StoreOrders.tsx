import { useState, useMemo } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { sendOrderWhatsApp } from "@/lib/whatsappAutomation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag, Truck, Search, X, CalendarIcon, CheckSquare, ChevronRight, Phone, MapPin, CreditCard, Package, FileText, Copy, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import OrderInvoice from "@/components/OrderInvoice";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";

const STATUS_OPTIONS = ["confirmed", "shipped", "delivered", "cancelled", "partially_paid"] as const;

const statusColor = (status: string) => {
  switch (status) {
    case "confirmed": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "shipped": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "delivered": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "partially_paid": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function StoreOrders() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [trackingOrder, setTrackingOrder] = useState<any>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [invoiceOrder, setInvoiceOrder] = useState<any>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [mobileDetailOrder, setMobileDetailOrder] = useState<any>(null);

  // Search & filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: store } = useStoreData(storeId);

  // Count query for server-side pagination
  const { data: orderCount } = useQuery({
    queryKey: ["website-orders-count", storeId, statusFilter],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId!);
      if (statusFilter) query = query.eq("status", statusFilter);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!storeId,
  });

  const pagination = usePagination(orderCount);

  const { data: allOrders, isLoading } = useQuery({
    queryKey: ["website-orders-all", storeId, statusFilter, pagination.from, pagination.to],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, order_number, created_at, status, total, currency, customer_name, customer_phone, payment_method, tracking_number, tracking_url, street_address, city, state, pincode, notes, storefront_customer_id, order_items(id, product_name, quantity, unit_price, total, product_id)")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .range(pagination.from, pagination.to);
      if (statusFilter) query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!storeId,
  });

  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    let result = [...allOrders];
    // Search is client-side on current page
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(o => {
        const displayId = o.order_number ? `#${1000 + o.order_number}` : o.id.slice(0, 8);
        return displayId.toLowerCase().includes(q) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.customer_phone && o.customer_phone.includes(q));
      });
    }
    // Date filters are client-side on current page
    if (dateFrom) {
      const fromStart = new Date(dateFrom);
      fromStart.setHours(0, 0, 0, 0);
      result = result.filter(o => new Date(o.created_at) >= fromStart);
    }
    if (dateTo) {
      const toEnd = new Date(dateTo);
      toEnd.setHours(23, 59, 59, 999);
      result = result.filter(o => new Date(o.created_at) <= toEnd);
    }
    return result;
  }, [allOrders, search, dateFrom, dateTo]);

  const paginatedOrders = filteredOrders;

  const hasActiveFilters = !!search || !!statusFilter || !!dateFrom || !!dateTo;
  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter(null);
    setDateFrom(undefined);
    setDateTo(undefined);
    pagination.setPage(1);
  };

  const updateWebStatus = useMutation({
    mutationFn: async ({ orderId, status, tracking_number, tracking_url }: { orderId: string; status: string; tracking_number?: string; tracking_url?: string }) => {
      const update: any = { status };
      if (tracking_number !== undefined) update.tracking_number = tracking_number;
      if (tracking_url !== undefined) update.tracking_url = tracking_url;
      const { error } = await (supabase as any).from("orders").update(update).eq("id", orderId);
      if (error) throw error;
      return { orderId, status, tracking_number, tracking_url };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["website-orders-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["website-orders-count", storeId] });
      toast.success("Order updated");

      if (storeId && result) {
        const order = allOrders?.find((o: any) => o.id === result.orderId);
        if (order) {
          const msgType = result.status === "confirmed" ? "order_confirmation"
            : result.status === "shipped" ? "shipping_update"
            : result.status === "delivered" ? "delivery_confirmation"
            : null;
          if (msgType) {
            const orderItems = (order as any).order_items || [];
            const productNames = orderItems.map((i: any) => i.product_name).filter(Boolean).join(", ");
            sendOrderWhatsApp(storeId, result.orderId, msgType as any, {
              customer_phone: (order as any).customer_phone,
              customer_name: (order as any).customer_name,
              total: (order as any).total,
              currency: (order as any).currency,
              tracking_url: result.tracking_url || (order as any).tracking_url,
              tracking_number: result.tracking_number || (order as any).tracking_number,
              product_names: productNames,
              store_name: (store as any)?.name,
            });
          }
        }
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      // Delete order items first, then the order
      await (supabase as any).from("order_items").delete().eq("order_id", orderId);
      const { error } = await (supabase as any).from("orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-orders-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["website-orders-count", storeId] });
      toast.success("Order deleted");
      setMobileDetailOrder(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ orderIds, status }: { orderIds: string[]; status: string }) => {
      const promises = orderIds.map(id =>
        (supabase as any).from("orders").update({ status }).eq("id", id)
      );
      const results = await Promise.all(promises);
      const failed = results.filter((r: any) => r.error);
      if (failed.length > 0) throw new Error(`${failed.length} orders failed to update`);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["website-orders-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["website-orders-count", storeId] });
      toast.success(`${vars.orderIds.length} orders updated to ${vars.status}`);
      setSelectedOrders(new Set());
      setBulkStatus("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === paginatedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(paginatedOrders.map((o: any) => o.id)));
    }
  };

  const getOrderDisplayId = (order: any) =>
    order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8)}`;

  const handleStatusChange = (order: any, v: string) => {
    if (v === "shipped" && !order.tracking_number) {
      setTrackingOrder(order);
      setTrackingNumber(order.tracking_number || "");
      setTrackingUrl(order.tracking_url || "");
      setPendingStatus(v);
      return;
    }
    updateWebStatus.mutate({ orderId: order.id, status: v });
  };

  if (!store && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Store not found</p>
        <Button asChild variant="outline"><Link to="/dashboard/stores">Back to stores</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/dashboard/stores"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">{store?.name}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border shadow-none">
        <CardContent className="p-2.5 space-y-2.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone or order ID"
                value={search}
                onChange={e => { setSearch(e.target.value); pagination.setPage(1); }}
                className="pl-8 h-9 text-sm"
              />
              {search && (
                <button onClick={() => { setSearch(""); pagination.setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 shrink-0 text-xs gap-1.5", (dateFrom || dateTo) && "border-primary text-primary")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom && dateTo ? `${format(dateFrom, "MMM d")} – ${format(dateTo, "MMM d")}` : dateFrom ? `From ${format(dateFrom, "MMM d")}` : dateTo ? `Until ${format(dateTo, "MMM d")}` : "Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 space-y-3" align="end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">From</p>
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); pagination.setPage(1); }} className="p-0 pointer-events-auto" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">To</p>
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); pagination.setPage(1); }} className="p-0 pointer-events-auto" />
                </div>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); pagination.setPage(1); }}>
                    Clear dates
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Status pills */}
          <div className="flex gap-1.5 items-center overflow-x-auto">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(statusFilter === s ? null : s); pagination.setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                  statusFilter === s
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-input hover:bg-accent"
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex gap-1.5 flex-wrap items-center">
              {statusFilter && (
                <Badge variant="secondary" className="gap-1 text-xs pr-1">
                  {statusFilter}
                  <button onClick={() => { setStatusFilter(null); pagination.setPage(1); }}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {dateFrom && (
                <Badge variant="secondary" className="gap-1 text-xs pr-1">
                  From {format(dateFrom, "MMM d")}
                  <button onClick={() => { setDateFrom(undefined); pagination.setPage(1); }}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {dateTo && (
                <Badge variant="secondary" className="gap-1 text-xs pr-1">
                  Until {format(dateTo, "MMM d")}
                  <button onClick={() => { setDateTo(undefined); pagination.setPage(1); }}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              <button onClick={clearAllFilters} className="text-xs text-primary font-medium">Clear all</button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : paginatedOrders.length > 0 ? (
        <>
          {/* Bulk Action Bar */}
          {selectedOrders.size > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""} selected
                </span>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Set status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!bulkStatus || bulkUpdateStatus.isPending}
                  onClick={() => {
                    if (bulkStatus) {
                      bulkUpdateStatus.mutate({
                        orderIds: Array.from(selectedOrders),
                        status: bulkStatus,
                      });
                    }
                  }}
                >
                  {bulkUpdateStatus.isPending ? "Updating..." : "Apply"}
                </Button>
                <button
                  onClick={() => setSelectedOrders(new Set())}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear selection
                </button>
              </CardContent>
            </Card>
          )}

          {/* ── MOBILE: Card list view ── */}
          {isMobile ? (
            <div className="space-y-2">
              {paginatedOrders.map((order: any) => (
                <button
                  key={order.id}
                  onClick={() => setMobileDetailOrder(order)}
                  className="w-full text-left rounded-xl border bg-card p-3.5 active:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-semibold text-foreground">{getOrderDisplayId(order)}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", statusColor(order.status))}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{order.customer_name || "Guest"}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), "MMM d, yyyy · h:mm a")}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0">{order.currency} {Number(order.total).toFixed(0)}</p>
                  </div>
                  {order.order_items && order.order_items.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-1">
                      {order.order_items.map((i: any) => i.product_name).join(", ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            /* ── DESKTOP: Table view ── */
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={paginatedOrders.length > 0 && selectedOrders.size === paginatedOrders.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order: any) => (
                      <TableRow key={order.id} className={selectedOrders.has(order.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{getOrderDisplayId(order)}</TableCell>
                        <TableCell className="font-medium text-foreground">{order.customer_name || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{order.customer_phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}
                        </TableCell>
                        <TableCell className="text-right">{order.currency} {Number(order.total).toFixed(2)}</TableCell>
                        <TableCell className="text-xs uppercase">{order.payment_method || "cod"}</TableCell>
                        <TableCell>
                          <Select value={order.status} onValueChange={(v) => handleStatusChange(order, v)}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {order.tracking_number && (
                            <div className="flex items-center gap-1 mt-1">
                              <Truck className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">{order.tracking_number}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(order.created_at), "MMM d, HH:mm")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setInvoiceOrder(order)}>Invoice</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <PaginationControls page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} />
          <p className="text-center text-xs text-muted-foreground">
            Showing {pagination.from + 1}–{Math.min(pagination.from + paginatedOrders.length, filteredOrders.length)} of {filteredOrders.length} orders
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">{hasActiveFilters ? "No orders match your filters" : "No orders yet"}</p>
            {!hasActiveFilters && <p className="text-sm text-muted-foreground">Orders will appear here when customers place them through your store</p>}
          </CardContent>
        </Card>
      )}

      {/* ── MOBILE ORDER DETAIL SHEET ── */}
      <Sheet open={!!mobileDetailOrder} onOpenChange={(v) => { if (!v) setMobileDetailOrder(null); }}>
        <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl px-0 overflow-hidden flex flex-col">
          {mobileDetailOrder && (
            <MobileOrderDetail
              order={mobileDetailOrder}
              store={store}
              onStatusChange={(v) => {
                handleStatusChange(mobileDetailOrder, v);
                setMobileDetailOrder((prev: any) => prev ? { ...prev, status: v } : null);
              }}
              onInvoice={() => { setInvoiceOrder(mobileDetailOrder); }}
              onDelete={() => deleteOrder.mutate(mobileDetailOrder.id)}
              isDeleting={deleteOrder.isPending}
              onClose={() => setMobileDetailOrder(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Tracking Number Dialog */}
      <Dialog open={!!trackingOrder} onOpenChange={(v) => { if (!v) setTrackingOrder(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Tracking Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tracking Number</label>
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. AWB123456789" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Tracking URL (optional)</label>
              <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://track.delhivery.com/..." />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                updateWebStatus.mutate({
                  orderId: trackingOrder.id,
                  status: pendingStatus,
                  tracking_number: trackingNumber.trim() || undefined,
                  tracking_url: trackingUrl.trim() || undefined,
                });
                setTrackingOrder(null);
              }}
            >
              Update to Shipped
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={!!invoiceOrder} onOpenChange={(v) => { if (!v) setInvoiceOrder(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {invoiceOrder && <OrderInvoice order={invoiceOrder} store={store} onClose={() => setInvoiceOrder(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Mobile Order Detail — Shopify-style bottom sheet
   ══════════════════════════════════════════════ */
function MobileOrderDetail({ order, store, onStatusChange, onInvoice, onDelete, isDeleting, onClose }: {
  order: any;
  store: any;
  onStatusChange: (status: string) => void;
  onInvoice: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  onClose: () => void;
}) {
  const items = order.order_items || [];
  const displayId = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8)}`;
  const address = [order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

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
        {/* ── Customer ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {(order.customer_name || "G")[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{order.customer_name || "Guest"}</p>
                {order.customer_phone && (
                  <button
                    onClick={() => copyToClipboard(order.customer_phone)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="h-3 w-3" />
                    {order.customer_phone}
                    <Copy className="h-2.5 w-2.5 ml-0.5" />
                  </button>
                )}
              </div>
              {order.customer_phone && (
                <a
                  href={`https://wa.me/${order.customer_phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
                >
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ── Address ── */}
        {address && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delivery Address</h3>
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-foreground leading-relaxed">{address}</p>
            </div>
          </section>
        )}

        <Separator />

        {/* ── Items ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Items ({items.length})
          </h3>
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

        {/* ── Payment & Tracking ── */}
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
                <button onClick={() => copyToClipboard(order.tracking_number)} className="text-muted-foreground hover:text-foreground">
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

        {order.notes && (
          <>
            <Separator />
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">{order.notes}</p>
            </section>
          </>
        )}
      </div>

      {/* ── Bottom Actions ── */}
      <div className="border-t px-4 py-3 space-y-2.5 bg-background" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2">
          <Select value={order.status} onValueChange={onStatusChange}>
            <SelectTrigger className="flex-1 h-11 text-sm font-medium">
              <SelectValue placeholder="Update status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={onInvoice}>
            <FileText className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this order and all its items. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
}
