import { useState, useMemo, useEffect } from "react";
import PaginationControls from "@/components/PaginationControls";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sendAbandonedCartWhatsApp } from "@/lib/whatsappAutomation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, ShoppingCart, MessageSquare, CalendarIcon, Send,
  Filter, X, CheckCircle2, Clock, Users,
} from "lucide-react";
import { toast } from "sonner";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";

const QUICK_FILTERS = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "Last 3 Days", days: 3 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
];

export default function StoreAbandonedCarts() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();

  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [activeQuick, setActiveQuick] = useState<number | null>(null);
  const [showRecovered, setShowRecovered] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, failed: 0, total: 0 });

  const { data: carts, isLoading } = useQuery({
    queryKey: ["abandoned-carts", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("abandoned_carts")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!storeId && !!user,
  });

  const applyQuickFilter = (days: number) => {
    if (days === 0) {
      setDateFrom(startOfDay(new Date()));
      setDateTo(endOfDay(new Date()));
    } else if (days === 1) {
      const yesterday = subDays(new Date(), 1);
      setDateFrom(startOfDay(yesterday));
      setDateTo(endOfDay(yesterday));
    } else {
      setDateFrom(startOfDay(subDays(new Date(), days)));
      setDateTo(endOfDay(new Date()));
    }
    setActiveQuick(days);
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setActiveQuick(null);
    setShowRecovered(false);
  };

  const filtered = useMemo(() => {
    if (!carts) return [];
    return carts.filter((c: any) => {
      if (!showRecovered && c.recovered) return false;
      if (dateFrom && dateTo) {
        const d = new Date(c.created_at);
        if (!isWithinInterval(d, { start: dateFrom, end: dateTo })) return false;
      }
      return true;
    });
  }, [carts, dateFrom, dateTo, showRecovered]);

  // Client-side pagination (20 per page)
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [dateFrom, dateTo, showRecovered, activeQuick]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );


  // Only non-recovered carts with phone numbers are sendable
  const sendable = useMemo(
    () => filtered.filter((c: any) => !c.recovered && c.customer_phone),
    [filtered]
  );

  const selectedSendable = useMemo(
    () => sendable.filter((c: any) => selected.has(c.id)),
    [sendable, selected]
  );

  const toggleAll = () => {
    if (selected.size === sendable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sendable.map((c: any) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const getCartData = (cart: any) => {
    const items = Array.isArray(cart.cart_items) ? cart.cart_items : [];
    const productNames = items.map((i: any) => i.name || i.product_name).filter(Boolean).join(", ");
    const cartTotal = items.reduce((sum: number, i: any) => sum + ((i.price || i.unit_price || 0) * (i.quantity || 1)), 0);
    return { product_names: productNames || "your items", cart_total: cartTotal, currency: "₹" };
  };

  const sendBulkRecovery = async (targets: any[]) => {
    if (!storeId || targets.length === 0) return;
    setSending(true);
    setBulkProgress({ sent: 0, failed: 0, total: targets.length });

    let sent = 0, failed = 0;
    for (const cart of targets) {
      try {
        await sendAbandonedCartWhatsApp(storeId, cart.id, cart.customer_phone, cart.customer_name, getCartData(cart));
        sent++;
      } catch {
        failed++;
      }
      setBulkProgress({ sent, failed, total: targets.length });
      await new Promise((r) => setTimeout(r, 500));
    }

    setSending(false);
    setSelected(new Set());
    toast.success(`Recovery messages sent! ✅ ${sent} sent, ❌ ${failed} failed`);
  };

  const stats = useMemo(() => {
    if (!carts) return { total: 0, recovered: 0, withPhone: 0, today: 0 };
    return {
      total: carts.length,
      recovered: carts.filter((c: any) => c.recovered).length,
      withPhone: carts.filter((c: any) => c.customer_phone && !c.recovered).length,
      today: carts.filter((c: any) => isToday(new Date(c.created_at))).length,
    };
  }, [carts]);

  const hasFilters = !!dateFrom || !!dateTo || showRecovered;
  const progressPercent = bulkProgress.total > 0
    ? ((bulkProgress.sent + bulkProgress.failed) / bulkProgress.total) * 100
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Abandoned Carts
        </h1>
        <p className="text-sm text-muted-foreground">Send recovery messages to customers who didn't complete checkout</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Abandoned", value: stats.total, icon: ShoppingCart, color: "text-orange-500" },
          { label: "Recovered", value: stats.recovered, icon: CheckCircle2, color: "text-green-500" },
          { label: "Recoverable", value: stats.withPhone, icon: MessageSquare, color: "text-blue-500" },
          { label: "Today", value: stats.today, icon: Clock, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <s.icon className={cn("h-4 w-4", s.color)} />
                <span className="text-xl font-bold">{s.value}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {QUICK_FILTERS.map((f) => (
              <Button
                key={f.days}
                variant={activeQuick === f.days ? "default" : "outline"}
                size="sm"
                className="text-xs h-7"
                onClick={() => applyQuickFilter(f.days)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {dateFrom ? format(dateFrom, "dd MMM") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => { setDateFrom(d); setActiveQuick(null); }}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {dateTo ? format(dateTo, "dd MMM") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(d) => { setDateTo(d ? endOfDay(d) : undefined); setActiveQuick(null); }}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
              <Checkbox
                checked={showRecovered}
                onCheckedChange={(v) => setShowRecovered(!!v)}
              />
              Show recovered
            </label>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {selected.size} cart{selected.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  Deselect All
                </Button>
                <Button
                  size="sm"
                  disabled={sending || selectedSendable.length === 0}
                  onClick={() => sendBulkRecovery(selectedSendable)}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send to {selectedSendable.length}
                </Button>
              </div>
            </div>
            {sending && (
              <div className="mt-2 space-y-1">
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>✅ {bulkProgress.sent} sent</span>
                  <span>❌ {bulkProgress.failed} failed</span>
                  <span>{bulkProgress.sent + bulkProgress.failed}/{bulkProgress.total}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Send All Button */}
      {sendable.length > 0 && selected.size === 0 && (
        <Button
          variant="outline"
          className="w-full"
          disabled={sending}
          onClick={() => {
            setSelected(new Set(sendable.map((c: any) => c.id)));
          }}
        >
          <Users className="mr-2 h-4 w-4" />
          Select All {sendable.length} Recoverable Carts
        </Button>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {hasFilters ? "No carts match your filters" : "No abandoned carts yet"}
              </p>
              {hasFilters && (
                <Button variant="link" size="sm" onClick={clearFilters} className="mt-1">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === sendable.length && sendable.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => {
                    const items = Array.isArray(c.cart_items) ? c.cart_items : [];
                    const canSend = !c.recovered && c.customer_phone;
                    const cartDate = new Date(c.created_at);
                    const dateLabel = isToday(cartDate) ? "Today" : isYesterday(cartDate) ? "Yesterday" : format(cartDate, "dd MMM yyyy");

                    return (
                      <TableRow key={c.id} className={selected.has(c.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          {canSend && (
                            <Checkbox
                              checked={selected.has(c.id)}
                              onCheckedChange={() => toggleOne(c.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{dateLabel}</div>
                          <div className="text-[11px] text-muted-foreground">{format(cartDate, "hh:mm a")}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{c.customer_phone || c.customer_email || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{items.length} item{items.length !== 1 ? "s" : ""}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                            {items.map((i: any) => i.name || i.product_name).join(", ")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.recovered ? "default" : "secondary"} className="text-[10px]">
                            {c.recovered ? "Recovered" : "Abandoned"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canSend && storeId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              disabled={sending}
                              onClick={() => {
                                sendAbandonedCartWhatsApp(storeId, c.id, c.customer_phone, c.customer_name, getCartData(c));
                                toast.success("Recovery message sent!");
                              }}
                            >
                              <MessageSquare className="mr-1 h-3 w-3" />
                              Send
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
