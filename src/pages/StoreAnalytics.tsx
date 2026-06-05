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
  ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingBag, Eye, DollarSign, Users,
  ShoppingCart, Repeat, ArrowUpRight, Package, BarChart3, CalendarIcon,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, parseISO, differenceInDays } from "date-fns";

type DateRange = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom" | "all";

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
  const [calendarOpen, setCalendarOpen] = useState(false);

  const storeId = store?.id as string | undefined;
  const storeIds = storeId ? [storeId] : [];
  const currency = store?.currency || "USD";
  const sym = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  // Orders — capped to range start (perf fix). 'all' fetches everything.
  const ordersGte = useMemo(() => {
    if (dateRange === "all") return null;
    if (dateRange === "today") return startOfDay(new Date()).toISOString();
    if (dateRange === "yesterday") return startOfDay(subDays(new Date(), 2)).toISOString();
    if (dateRange === "custom" && customFrom) return startOfDay(customFrom).toISOString();
    const d = dateRange === "7d" ? 14 : dateRange === "30d" ? 60 : 180;
    return startOfDay(subDays(new Date(), d)).toISOString();
  }, [dateRange, customFrom]);

  const { data: allOrders, isLoading } = useQuery({
    queryKey: ["analytics-orders", storeIds, ordersGte],
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("created_at, total, status, payment_method, customer_name, order_items(product_name, quantity, total)")
        .in("store_id", storeIds)
        .order("created_at", { ascending: true });
      if (ordersGte) q = q.gte("created_at", ordersGte);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: storeIds.length > 0,
  });

  // Page views — raw is kept for 30 days only. For older periods we read
  // from page_views_daily (rollup, kept forever). We always cap the raw
  // query at the last 30 days so the dashboard never pulls millions of rows.
  const { data: pageViews } = useQuery({
    queryKey: ["analytics-views", storeIds],
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      // NOTE: Supabase caps queries at 1000 rows by default. Stores with high
      // traffic blow past that within 30 days, and ascending order made today's
      // rows the ones cut off → "Today" tab showed 0 sessions. Fix: order
      // descending (today first) and lift the row cap explicitly.
      const { data, error } = await supabase
        .from("page_views")
        .select("created_at, path, visitor_id, session_id, is_bot")
        .in("store_id", storeIds)
        .eq("is_bot", false)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50000);
      if (error) throw error;
      return data as any[];
    },
    enabled: storeIds.length > 0,
  });

  // Historical daily rollups — used for ranges > 30 days (90d / custom / all)
  const { data: viewsDaily } = useQuery({
    queryKey: ["analytics-views-daily", storeIds],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_views_daily")
        .select("date, pageviews, sessions, visitors")
        .in("store_id", storeIds)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: storeIds.length > 0,
  });




  // Customers
  const { data: customers } = useQuery({
    queryKey: ["analytics-customers", storeIds],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, created_at, order_count")
        .in("store_id", storeIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: storeIds.length > 0,
  });

  // Range computation — all bounds are inclusive [start, end] in ms.
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
  const rangeDays = dateRange === "today" || dateRange === "yesterday"
    ? 1
    : dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90
    : dateRange === "custom" && customFrom && customTo ? (differenceInDays(customTo, customFrom) || 1)
    : 9999;

  const inRange = (iso: string, start: Date, end: Date) => {
    const t = parseISO(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const filtered = useMemo(() => {
    if (!allOrders) return { current: [], prior: [] };
    const current = allOrders.filter((o: any) =>
      dateRange === "all" ? true : inRange(o.created_at, rangeStart, rangeEnd)
    );
    const prior = allOrders.filter((o: any) => inRange(o.created_at, priorStart, priorEnd));
    return { current, prior };
  }, [allOrders, dateRange, customFrom, customTo]);

  const filteredViews = useMemo(() => {
    if (!pageViews) return { current: [], prior: [] };
    const current = pageViews.filter((v: any) =>
      dateRange === "all" ? true : inRange(v.created_at, rangeStart, rangeEnd)
    );
    const prior = pageViews.filter((v: any) => inRange(v.created_at, priorStart, priorEnd));
    return { current, prior };
  }, [pageViews, dateRange, customFrom, customTo]);

  const { data: trafficTotals } = useQuery({
    queryKey: [
      "analytics-traffic-exact",
      storeId,
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      priorStart.toISOString(),
      priorEnd.toISOString(),
    ],
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_analytics_traffic", {
        _store_id: storeId,
        _range_start: rangeStart.toISOString(),
        _range_end: rangeEnd.toISOString(),
        _prior_start: priorStart.toISOString(),
        _prior_end: priorEnd.toISOString(),
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

  // Metrics — only count confirmed revenue (exclude pending & cancelled)
  const REVENUE_STATUSES = new Set(["confirmed", "shipped", "delivered", "partially_paid"]);
  const isRevenue = (o: any) => REVENUE_STATUSES.has(o.status);
  const totalRevenue = filtered.current.filter(isRevenue).reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const priorRevenue = filtered.prior.filter(isRevenue).reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const revenueChange = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : undefined;

  const totalOrders = filtered.current.filter(isRevenue).length;
  const priorOrders = filtered.prior.filter(isRevenue).length;
  const ordersChange = priorOrders > 0 ? ((totalOrders - priorOrders) / priorOrders) * 100 : undefined;

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const priorAOV = priorOrders > 0 ? priorRevenue / priorOrders : 0;
  const aovChange = priorAOV > 0 ? ((avgOrderValue - priorAOV) / priorAOV) * 100 : undefined;

  const sessionKey = (v: any) => v.session_id || v.visitor_id || "anon";
  const visitorKey = (v: any) => v.visitor_id || v.session_id || "anon";

  // Rollup is the source of truth for any day strictly before TODAY.
  // Raw page_views is used only for today (the bucket that hasn't been
  // rolled up by the nightly cron yet). This makes 7d/30d/90d/yesterday
  // accurate forever — even after raw rows are purged at 90 days — because
  // page_views_daily is preserved permanently.
  const todayStart = startOfDay(now);

  const sumRollup = (field: "sessions" | "visitors" | "pageviews", start: Date, end: Date) => {
    if (!viewsDaily) return 0;
    return viewsDaily
      .filter((r: any) => {
        const d = parseISO(r.date);
        return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
      })
      .reduce((s: number, r: any) => s + (Number(r[field]) || 0), 0);
  };

  const rawUnique = (rows: any[], key: (v: any) => string, fromTs: number) =>
    new Set(
      rows
        .filter((v: any) => parseISO(v.created_at).getTime() >= fromTs)
        .map(key)
    ).size;

  const computeMetric = (
    rows: any[],
    rollupField: "sessions" | "visitors",
    keyFn: (v: any) => string,
    start: Date,
    end: Date,
  ) => {
    // Rollup covers [start, min(end, todayStart))
    const rollupEnd = end.getTime() < todayStart.getTime() ? end : todayStart;
    const rollupVal = start.getTime() < rollupEnd.getTime()
      ? sumRollup(rollupField, start, rollupEnd)
      : 0;
    // Raw covers today only — if range includes today.
    const includesToday = end.getTime() >= todayStart.getTime();
    const rawVal = includesToday ? rawUnique(rows, keyFn, todayStart.getTime()) : 0;
    return rollupVal + rawVal;
  };

  const totalSessions = useMemo(
    () => trafficTotals?.sessions ?? computeMetric(filteredViews.current, "sessions", sessionKey, rangeStart, rangeEnd),
    [trafficTotals?.sessions, filteredViews.current, viewsDaily, rangeStart, rangeEnd]
  );
  const priorSessions = useMemo(
    () => trafficTotals?.prior_sessions ?? computeMetric(filteredViews.prior, "sessions", sessionKey, priorStart, priorEnd),
    [trafficTotals?.prior_sessions, filteredViews.prior, viewsDaily, priorStart, priorEnd]
  );
  const sessionsChange = priorSessions > 0 ? ((totalSessions - priorSessions) / priorSessions) * 100 : undefined;

  const totalVisitors = useMemo(
    () => trafficTotals?.visitors ?? computeMetric(filteredViews.current, "visitors", visitorKey, rangeStart, rangeEnd),
    [trafficTotals?.visitors, filteredViews.current, viewsDaily, rangeStart, rangeEnd]
  );
  const priorVisitors = useMemo(
    () => trafficTotals?.prior_visitors ?? computeMetric(filteredViews.prior, "visitors", visitorKey, priorStart, priorEnd),
    [trafficTotals?.prior_visitors, filteredViews.prior, viewsDaily, priorStart, priorEnd]
  );
  const visitorsChange = priorVisitors > 0 ? ((totalVisitors - priorVisitors) / priorVisitors) * 100 : undefined;

  const conversionRate = totalSessions > 0 ? (totalOrders / totalSessions) * 100 : 0;
  const priorConversion = priorSessions > 0 ? (priorOrders / priorSessions) * 100 : 0;
  const conversionChange = priorConversion > 0 ? ((conversionRate - priorConversion) / priorConversion) * 100 : undefined;

  const returningCustomers = customers?.filter((c: any) => c.order_count > 1).length || 0;
  const totalCustomers = customers?.length || 0;
  const returningRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

  // Charts data
  const salesByDay = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; orders: number }> = {};
    filtered.current.filter(isRevenue).forEach((o: any) => {
      const day = o.created_at.slice(0, 10);
      if (!map[day]) map[day] = { date: day, revenue: 0, orders: 0 };
      map[day].revenue += Number(o.total || 0);
      map[day].orders += 1;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered.current]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; units: number; revenue: number }> = {};
    filtered.current.filter(isRevenue).forEach((o: any) => {
      o.order_items?.forEach((item: any) => {
        const key = item.product_name;
        if (!map[key]) map[key] = { name: key, units: 0, revenue: 0 };
        map[key].units += item.quantity || 1;
        map[key].revenue += Number(item.total || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filtered.current]);

  const ordersByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.current.forEach((o: any) => {
      const status = o.status || "unknown";
      map[status] = (map[status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered.current]);

  const paymentMethods = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.current.filter((o: any) => o.status !== "cancelled").forEach((o: any) => {
      const method = o.payment_method || "Unknown";
      map[method] = (map[method] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered.current]);

  const viewsByDay = useMemo(() => {
    // Today: unique sessions from raw page_views (not yet rolled up).
    const todayMap: Record<string, Set<string>> = {};
    filteredViews.current
      .filter((v: any) => parseISO(v.created_at).getTime() >= todayStart.getTime())
      .forEach((v: any) => {
        const day = v.created_at.slice(0, 10);
        if (!todayMap[day]) todayMap[day] = new Set();
        todayMap[day].add(sessionKey(v));
      });
    const todayBuckets = Object.entries(todayMap).map(([date, set]) => ({ date, views: set.size }));

    // Past days (< today): use rollup so charts stay accurate forever.
    const past = (viewsDaily || [])
      .filter((r: any) => {
        const t = parseISO(r.date).getTime();
        return t >= rangeStart.getTime() && t < todayStart.getTime() && t <= rangeEnd.getTime();
      })
      .map((r: any) => ({ date: r.date, views: Number(r.sessions) || 0 }));

    return [...past, ...todayBuckets].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredViews.current, viewsDaily, rangeStart, rangeEnd]);


  const topPages = useMemo(() => {
    const map: Record<string, number> = {};
    filteredViews.current.forEach((v: any) => {
      const path = v.path || "/";
      map[path] = (map[path] || 0) + 1;
    });
    return Object.entries(map)
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [filteredViews.current]);

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
        <div className="grid grid-cols-2 gap-2.5">
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
              <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5 justify-start", !customFrom && "text-muted-foreground")}>
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
              <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5 justify-start", !customTo && "text-muted-foreground")}>
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
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard title="Total Sales" value={totalRevenue.toFixed(0)} prefix={sym} icon={DollarSign} change={revenueChange} />
        <MetricCard title="Orders" value={totalOrders} icon={ShoppingBag} change={ordersChange} />
        <MetricCard title="Sessions" value={totalSessions} icon={Eye} change={sessionsChange} />
        <MetricCard title="Avg Order" value={avgOrderValue.toFixed(0)} prefix={sym} icon={ShoppingCart} change={aovChange} />
      </div>

      {/* Conversion, Returning & Unique Visitors */}
      <div className="grid grid-cols-2 gap-2.5">
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
                        className="h-full rounded-full bg-primary transition-all"
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
          totalSessions={totalSessions}
          sym={sym}
        />
      )}
    </div>
  );
}
