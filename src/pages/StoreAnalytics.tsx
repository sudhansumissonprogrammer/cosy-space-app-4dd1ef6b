import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AnalyticsAdvancedSections from "@/components/dashboard/AnalyticsAdvancedSections";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingBag, Eye, DollarSign, Users,
  ShoppingCart, Repeat, ArrowUpRight, CalendarIcon,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, parseISO, differenceInDays } from "date-fns";

type DateRange = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom" | "all";

interface TrafficTotalsPayload {
  sessions?: number | string;
  visitors?: number | string;
  prior_sessions?: number | string;
  prior_visitors?: number | string;
}

interface SalesAnalyticsPayload {
  total_revenue?: number | string;
  prior_revenue?: number | string;
  total_orders?: number | string;
  prior_orders?: number | string;
  sales_by_day?: Array<{ date: string; revenue: number | string; orders: number | string }>;
  top_products?: Array<{ name: string; units: number | string; revenue: number | string }>;
  orders_by_status?: Array<{ name: string; value: number | string }>;
  payment_methods?: Array<{ name: string; value: number | string }>;
}

interface AnalyticsBreakdownsPayload {
  top_pages?: Array<{ path: string; views: number | string }>;
  sources?: Array<{ name: string; value: number | string }>;
  countries?: Array<{ name: string; value: number | string }>;
  devices?: Array<{ name: string; value: number | string }>;
}

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{
    data: T | null;
    error: Error | null;
  }>;
};

function MetricCard({
  title, value, change, icon: Icon, prefix = "", suffix = "",
}: {
  title: string; value: string | number; change?: number;
  icon: React.ElementType; prefix?: string; suffix?: string;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <Card className="border shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xl font-bold text-foreground">{prefix}{value}{suffix}</p>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 mt-1 text-xs font-medium ${isPositive ? "text-emerald-600" : "text-destructive"}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}% vs prior period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 72%, 51%)",
];

export default function StoreAnalytics() {
  const { store } = useDashboardStore();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(subDays(new Date(), 14));
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date());

  const storeId = store?.id as string | undefined;
  const storeIds = storeId ? [storeId] : [];
  const currency = store?.currency || "USD";
  const sym = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  // Range computation — all bounds are inclusive for the current period.
  const now = new Date();
  let rangeStart: Date;
  let rangeEnd: Date;
  let priorStart: Date;
  let priorEnd: Date;

  if (dateRange === "today") {
    rangeStart = startOfDay(now);
    rangeEnd = now;
    priorStart = startOfDay(subDays(now, 1));
    priorEnd = endOfDay(subDays(now, 1));
  } else if (dateRange === "yesterday") {
    rangeStart = startOfDay(subDays(now, 1));
    rangeEnd = endOfDay(subDays(now, 1));
    priorStart = startOfDay(subDays(now, 2));
    priorEnd = endOfDay(subDays(now, 2));
  } else if (dateRange === "custom" && customFrom && customTo) {
    rangeStart = startOfDay(customFrom);
    rangeEnd = endOfDay(customTo);
    const span = differenceInDays(customTo, customFrom) || 1;
    priorStart = startOfDay(subDays(customFrom, span));
    priorEnd = startOfDay(customFrom);
  } else if (dateRange === "all") {
    rangeStart = new Date(0);
    rangeEnd = now;
    priorStart = new Date(0);
    priorEnd = new Date(0);
  } else {
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    rangeStart = startOfDay(subDays(now, days - 1));
    rangeEnd = now;
    priorStart = startOfDay(subDays(now, days * 2 - 1));
    priorEnd = startOfDay(subDays(now, days - 1));
  }
  const { data: salesAnalytics, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "analytics-sales-exact",
      storeId,
      dateRange,
      customFrom?.toISOString() || null,
      customTo?.toISOString() || null,
    ],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as RpcClient).rpc<SalesAnalyticsPayload>("get_store_sales_analytics", {
        _store_id: storeId,
        _range_start: rangeStart.toISOString(),
        _range_end: rangeEnd.toISOString(),
        _prior_start: priorStart.toISOString(),
        _prior_end: priorEnd.toISOString(),
      });
      if (error) throw error;
      return data || {};
    },
  });

  // Today's session count — exact server-side aggregate. Previously this pulled
  // up to 200k raw page_view rows into the browser just to size one chart bucket.
  const { data: todayTotals } = useQuery({
    queryKey: ["analytics-today-totals", storeId],
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as RpcClient).rpc<{ sessions?: number | string }>(
        "get_today_analytics",
        { _store_id: storeId },
      );
      if (error) throw error;
      return { sessions: Number(data?.sessions ?? 0) };
    },
  });

  // Historical daily rollups — used for ranges > 30 days (90d / custom / all)
  const { data: viewsDaily } = useQuery({
    queryKey: ["analytics-views-daily", storeIds],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      // Cap to last 365 days — nothing in the UI plots older than 1 year and the
      // table grows unbounded. Defends against multi-MB pulls on long-lived stores.
      const since = startOfDay(subDays(new Date(), 365)).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("page_views_daily")
        .select("date, pageviews, sessions, visitors")
        .in("store_id", storeIds)
        .gte("date", since)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: storeIds.length > 0,
  });

  // Order breakdown for the SELECTED range — exact, server-side. The old client
  // query silently truncated at 1000 rows and the repeat-rate card measured the
  // store's entire lifetime instead of the chosen period.
  const { data: ordersBreakdown } = useQuery({
    queryKey: [
      "analytics-orders-breakdown",
      storeId,
      dateRange,
      customFrom?.toISOString() || null,
      customTo?.toISOString() || null,
    ],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as RpcClient).rpc<Record<string, any>>(
        "get_analytics_orders_breakdown",
        {
          _store_id: storeId,
          _range_start: rangeStart.toISOString(),
          _range_end: rangeEnd.toISOString(),
        },
      );
      if (error) throw error;
      return data || {};
    },
  });


  const { data: trafficTotals } = useQuery({
    queryKey: [
      "analytics-traffic-exact",
      storeId,
      dateRange,
      customFrom?.toISOString() || null,
      customTo?.toISOString() || null,
    ],
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    enabled: !!storeId,
    queryFn: async () => {
      const current = new Date();
      let liveRangeStart: Date;
      let liveRangeEnd: Date;
      let livePriorStart: Date;
      let livePriorEnd: Date;

      if (dateRange === "today") {
        liveRangeStart = startOfDay(current);
        liveRangeEnd = current;
        livePriorStart = startOfDay(subDays(current, 1));
        livePriorEnd = endOfDay(subDays(current, 1));
      } else if (dateRange === "yesterday") {
        liveRangeStart = startOfDay(subDays(current, 1));
        liveRangeEnd = endOfDay(subDays(current, 1));
        livePriorStart = startOfDay(subDays(current, 2));
        livePriorEnd = endOfDay(subDays(current, 2));
      } else if (dateRange === "custom" && customFrom && customTo) {
        liveRangeStart = startOfDay(customFrom);
        liveRangeEnd = endOfDay(customTo);
        const span = differenceInDays(customTo, customFrom) || 1;
        livePriorStart = startOfDay(subDays(customFrom, span));
        livePriorEnd = startOfDay(customFrom);
      } else if (dateRange === "all") {
        liveRangeStart = new Date(0);
        liveRangeEnd = current;
        livePriorStart = new Date(0);
        livePriorEnd = new Date(0);
      } else {
        const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
        liveRangeStart = startOfDay(subDays(current, days - 1));
        liveRangeEnd = current;
        livePriorStart = startOfDay(subDays(current, days * 2 - 1));
        livePriorEnd = startOfDay(subDays(current, days - 1));
      }

      const { data, error } = await (supabase as unknown as RpcClient).rpc<TrafficTotalsPayload>("get_analytics_traffic", {
        _store_id: storeId,
        _range_start: liveRangeStart.toISOString(),
        _range_end: liveRangeEnd.toISOString(),
        _prior_start: livePriorStart.toISOString(),
        _prior_end: livePriorEnd.toISOString(),
      });
      if (error) throw error;
      return {
        sessions: Number(data?.sessions ?? 0),
        visitors: Number(data?.visitors ?? 0),
        prior_sessions: Number(data?.prior_sessions ?? 0),
        prior_visitors: Number(data?.prior_visitors ?? 0),
      };
    },
  });

  const { data: analyticsBreakdowns } = useQuery({
    queryKey: [
      "analytics-breakdowns-exact",
      storeId,
      dateRange,
      customFrom?.toISOString() || null,
      customTo?.toISOString() || null,
    ],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as RpcClient).rpc<AnalyticsBreakdownsPayload>("get_analytics_breakdowns", {
        _store_id: storeId,
        _range_start: rangeStart.toISOString(),
        _range_end: rangeEnd.toISOString(),
      });
      if (error) throw error;
      return data || {};
    },
  });

  // Sales metrics come from get_store_sales_analytics so totals are exact even
  // when a store has more rows than PostgREST/browser-safe fetch limits.
  const totalRevenue = Number(salesAnalytics?.total_revenue ?? 0);
  const priorRevenue = Number(salesAnalytics?.prior_revenue ?? 0);
  const revenueChange = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : undefined;

  const totalOrders = Number(salesAnalytics?.total_orders ?? 0);
  const priorOrders = Number(salesAnalytics?.prior_orders ?? 0);
  const ordersChange = priorOrders > 0 ? ((totalOrders - priorOrders) / priorOrders) * 100 : undefined;

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const priorAOV = priorOrders > 0 ? priorRevenue / priorOrders : 0;
  const aovChange = priorAOV > 0 ? ((avgOrderValue - priorAOV) / priorAOV) * 100 : undefined;

  const todayStart = startOfDay(now);

  const totalSessions = Number(trafficTotals?.sessions ?? 0);
  const priorSessions = Number(trafficTotals?.prior_sessions ?? 0);
  const sessionsChange = priorSessions > 0 ? ((totalSessions - priorSessions) / priorSessions) * 100 : undefined;

  const totalVisitors = Number(trafficTotals?.visitors ?? 0);
  const priorVisitors = Number(trafficTotals?.prior_visitors ?? 0);
  const visitorsChange = priorVisitors > 0 ? ((totalVisitors - priorVisitors) / priorVisitors) * 100 : undefined;

  const conversionRate = totalSessions > 0 ? (totalOrders / totalSessions) * 100 : 0;
  const priorConversion = priorSessions > 0 ? (priorOrders / priorSessions) * 100 : 0;
  const conversionChange = priorConversion > 0 ? ((conversionRate - priorConversion) / priorConversion) * 100 : undefined;

  // Repeat rate = share of PAID orders in this range placed by returning buyers.
  // (Was previously a lifetime customer-list ratio capped at 1000 rows, so it
  // never matched the selected date range.)
  const paidNew = Number(ordersBreakdown?.paid_new ?? 0);
  const paidRepeat = Number(ordersBreakdown?.paid_repeat ?? 0);
  const returningRate = paidNew + paidRepeat > 0 ? (paidRepeat / (paidNew + paidRepeat)) * 100 : 0;


  // Charts data
  const salesByDay = useMemo(() => (
    (salesAnalytics?.sales_by_day || []).map((d) => ({
      date: String(d.date),
      revenue: Number(d.revenue || 0),
      orders: Number(d.orders || 0),
    }))
  ), [salesAnalytics?.sales_by_day]);

  const topProducts = useMemo(() => (
    (salesAnalytics?.top_products || []).map((p) => ({
      name: String(p.name || "Unknown product"),
      units: Number(p.units || 0),
      revenue: Number(p.revenue || 0),
    }))
  ), [salesAnalytics?.top_products]);

  const ordersByStatus = useMemo(() => (
    (salesAnalytics?.orders_by_status || []).map((s) => ({
      name: String(s.name || "unknown"),
      value: Number(s.value || 0),
    }))
  ), [salesAnalytics?.orders_by_status]);

  const paymentMethods = useMemo(() => (
    (salesAnalytics?.payment_methods || []).map((m) => ({
      name: String(m.name || "Unknown"),
      value: Number(m.value || 0),
    }))
  ), [salesAnalytics?.payment_methods]);

  const viewsByDay = useMemo(() => {
    // Past days (< today): use rollup so charts stay accurate forever.
    const past = (viewsDaily || [])
      .filter((r: any) => {
        const t = parseISO(r.date).getTime();
        return t >= rangeStart.getTime() && t < todayStart.getTime() && t <= rangeEnd.getTime();
      })
      .map((r: any) => ({ date: r.date, views: Number(r.sessions) || 0 }));

    // Today is not rolled up yet — use the exact server-side session count.
    const includesToday = rangeEnd.getTime() >= todayStart.getTime();
    const todayBuckets = includesToday && (todayTotals?.sessions ?? 0) > 0
      ? [{ date: format(todayStart, "yyyy-MM-dd"), views: Number(todayTotals?.sessions || 0) }]
      : [];

    return [...past, ...todayBuckets].sort((a, b) => a.date.localeCompare(b.date));
  }, [todayTotals, viewsDaily, rangeStart, rangeEnd, todayStart]);



  const topPages = useMemo(() => {
    return (analyticsBreakdowns?.top_pages || []).map((p) => ({
      path: String(p.path || "/"),
      views: Number(p.views || 0),
    }));
  }, [analyticsBreakdowns?.top_pages]);

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
    fontSize: 12,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
      </div>

      {/* Date range tabs */}
      <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
        <TabsList className="h-8 w-full grid grid-cols-7">
          <TabsTrigger value="today" className="text-xs h-7">Today</TabsTrigger>
          <TabsTrigger value="yesterday" className="text-xs h-7">Yest.</TabsTrigger>
          <TabsTrigger value="7d" className="text-xs h-7">7d</TabsTrigger>
          <TabsTrigger value="30d" className="text-xs h-7">30d</TabsTrigger>
          <TabsTrigger value="90d" className="text-xs h-7">90d</TabsTrigger>
          <TabsTrigger value="all" className="text-xs h-7">All</TabsTrigger>
          <TabsTrigger value="custom" className="text-xs h-7">Custom</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Custom date range picker */}
      {dateRange === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5 justify-start", !customFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {customFrom ? format(customFrom, "MMM d, yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={setCustomFrom}
                disabled={(date) => date > new Date() || (customTo ? date > customTo : false)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5 justify-start", !customTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {customTo ? format(customTo, "MMM d, yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={setCustomTo}
                disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <MetricCard title="Total Sales" value={totalRevenue.toFixed(0)} prefix={sym} icon={DollarSign} change={revenueChange} />
        <MetricCard title="Orders" value={totalOrders} icon={ShoppingBag} change={ordersChange} />
        <MetricCard title="Sessions" value={totalSessions} icon={Eye} change={sessionsChange} />
        <MetricCard title="Avg Order" value={avgOrderValue.toFixed(0)} prefix={sym} icon={ShoppingCart} change={aovChange} />
      </div>

      {/* Conversion, Returning & Unique Visitors */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <MetricCard title="Unique Visitors" value={totalVisitors} icon={Users} change={visitorsChange} />
        <MetricCard title="Conversion" value={conversionRate.toFixed(2)} suffix="%" icon={ArrowUpRight} change={conversionChange} />
        <MetricCard title="Returning" value={returningRate.toFixed(1)} suffix="%" icon={Repeat} />
      </div>

      {/* Sales Over Time */}
      <Card className="border shadow-none">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-medium">Sales Over Time</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {salesByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={salesByDay}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(d) => format(parseISO(d), "MMM d")} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={40} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${sym}${v.toFixed(0)}`, "Revenue"]} labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No sales data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Orders Over Time */}
      <Card className="border shadow-none">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-medium">Orders Over Time</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {salesByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(d) => format(parseISO(d), "MMM d")} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={30} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No order data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Sessions / Traffic */}
      <Card className="border shadow-none">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-medium">Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {viewsByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={viewsByDay}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(d) => format(parseISO(d), "MMM d")} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={30} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")} />
                <Area type="monotone" dataKey="views" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#viewsGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No session data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Top Products by Revenue */}
      <Card className="border shadow-none">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-medium">Top Products</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {topProducts.length > 0 ? (
            <div className="space-y-2">
              {topProducts.map((product, i) => {
                const maxRev = topProducts[0]?.revenue || 1;
                const pct = (product.revenue / maxRev) * 100;
                return (
                  <div key={product.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-foreground font-medium max-w-[60%]">{product.name}</span>
                      <span className="text-muted-foreground shrink-0">{sym}{product.revenue.toFixed(0)} · {product.units} sold</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-[transform,opacity,colors,box-shadow]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No product data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Order Status & Payment Methods side by side */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="border shadow-none">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium">Order Status</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            {ordersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                    {ordersByStatus.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-6 text-center text-[10px] text-muted-foreground">No data</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ordersByStatus.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="capitalize">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            {paymentMethods.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                    {paymentMethods.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-6 text-center text-[10px] text-muted-foreground">No data</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {paymentMethods.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[(i + 2) % CHART_COLORS.length] }} />
                  <span className="capitalize">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Pages */}
      <Card className="border shadow-none">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-medium">Top Pages</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {topPages.length > 0 ? (
            <div className="space-y-1.5">
              {topPages.map((page) => (
                <div key={page.path} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                  <span className="text-foreground truncate max-w-[70%] font-mono text-[11px]">{page.path}</span>
                  <span className="text-muted-foreground shrink-0">{page.views} views</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No page view data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Advanced sections — live, funnel, sources, geo, device, cohort */}
      {store?.id && (
        <AnalyticsAdvancedSections
          storeId={store.id}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          breakdowns={analyticsBreakdowns}
          rangeSessions={totalSessions}
          ordersBreakdown={ordersBreakdown}
        />

      )}
    </div>
  );
}
