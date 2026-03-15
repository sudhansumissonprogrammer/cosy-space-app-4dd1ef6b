import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
import { ArrowLeft, ShoppingBag, Truck, Search, X, CalendarIcon, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import OrderInvoice from "@/components/OrderInvoice";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_OPTIONS = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

export default function StoreOrders() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [trackingOrder, setTrackingOrder] = useState<any>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [invoiceOrder, setInvoiceOrder] = useState<any>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");

  // Search & filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: store } = useQuery({
    queryKey: ["store", storeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").eq("id", storeId!).eq("owner_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  // Fetch all orders (up to 1000) for client-side filtering
  const { data: allOrders, isLoading } = useQuery({
    queryKey: ["website-orders-all", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("*, order_items(*)")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!storeId,
  });

  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    let result = [...allOrders];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(o =>
        o.id.slice(0, 8).toLowerCase().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.includes(q))
      );
    }
    if (statusFilter) {
      result = result.filter(o => o.status === statusFilter);
    }
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
  }, [allOrders, search, statusFilter, dateFrom, dateTo]);

  const pagination = usePagination(filteredOrders.length);
  const paginatedOrders = filteredOrders.slice(pagination.from, pagination.to + 1);

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
      toast.success("Order updated");

      // Auto-send WhatsApp based on new status
      if (storeId && result) {
        const order = orders?.find((o: any) => o.id === result.orderId);
        if (order) {
          const msgType = result.status === "confirmed" ? "order_confirmation"
            : result.status === "shipped" ? "shipping_update"
            : result.status === "delivered" ? "delivery_confirmation"
            : null;
          if (msgType) {
            sendOrderWhatsApp(storeId, result.orderId, msgType as any, {
              customer_phone: (order as any).customer_phone,
              customer_name: (order as any).customer_name,
              total: (order as any).total,
              currency: (order as any).currency,
              tracking_url: result.tracking_url || (order as any).tracking_url,
              tracking_number: result.tracking_number || (order as any).tracking_number,
            });
          }
        }
      }
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
            {/* Date range */}
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
                      <TableCell className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}</TableCell>
                      <TableCell className="font-medium text-foreground">{order.customer_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.customer_phone || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}
                      </TableCell>
                      <TableCell className="text-right">{order.currency} {Number(order.total).toFixed(2)}</TableCell>
                      <TableCell className="text-xs uppercase">{order.payment_method || "cod"}</TableCell>
                      <TableCell>
                        <Select value={order.status} onValueChange={(v) => {
                          if (v === "shipped" && !order.tracking_number) {
                            setTrackingOrder(order);
                            setTrackingNumber(order.tracking_number || "");
                            setTrackingUrl(order.tracking_url || "");
                            setPendingStatus(v);
                            return;
                          }
                          updateWebStatus.mutate({ orderId: order.id, status: v });
                        }}>
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
