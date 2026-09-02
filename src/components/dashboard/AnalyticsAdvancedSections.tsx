// Advanced analytics sections — live visitors, funnel, traffic sources, geography,
// device breakdown, retention cohort. All read from rollup tables when possible
// and gracefully hide when data is empty.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Activity, MapPin, Smartphone, Megaphone, GitBranch, RefreshCcw,
  TrendingDown, Timer, MousePointerClick,
} from "lucide-react";
import { parseISO, format } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 72%, 51%)",
  "hsl(199, 89%, 48%)",
  "hsl(45, 93%, 47%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
  fontSize: 12,
};

function MiniMetric({ label, value, icon: Icon, suffix = "" }: {
  label: string; value: string | number; icon: any; suffix?: string;
}) {
  return (
    <Card className="border shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-lg font-bold text-foreground">{value}{suffix}</p>
      </CardContent>
    </Card>
  );
}

interface Props {
  storeId: string;
  rangeStart: Date;
  rangeEnd: Date;
  breakdowns?: AnalyticsBreakdownsPayload;
  /** Exact de-duplicated sessions for the selected range (funnel entry step). */
  rangeSessions?: number;
  /** Exact server-side order aggregates for the selected range. */
  ordersBreakdown?: Record<string, any>;
}

interface AnalyticsBreakdownsPayload {
  sources?: Array<{ name: string; value: number | string }>;
  countries?: Array<{ name: string; value: number | string }>;
  devices?: Array<{ name: string; value: number | string }>;
}

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: Error | null }>;
};

type KeyCount = { key: string; n: number };

interface FunnelPayload {
  steps?: Record<string, number>;
  field_stops?: KeyCount[];
  pay_fail_reasons?: KeyCount[];
  zero_result_searches?: KeyCount[];
  cart_removes?: KeyCount[];
  variant_select_sessions?: number;
  pdp_deep_scroll_sessions?: number;
  attributed_pct?: number;
}


export default function AnalyticsAdvancedSections({ storeId, rangeStart, rangeEnd, breakdowns, rangeSessions, ordersBreakdown }: Props) {
  // Live visitors — last 5 min, refetched every 20s
  const { data: liveCount } = useQuery({
    queryKey: ["analytics-live-count", storeId],
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
    queryFn: async () => {
      // Paginated fetch — a 5-min window on a busy store can exceed the 1000-row
      // default cap. Range-scan defensively up to ~50k rows before giving up.
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const PAGE = 1000;
      const uniq = new Set<string>();
      for (let from = 0; from < 50_000; from += PAGE) {
        const { data, error } = await supabase
          .from("page_views")
          .select("session_id, visitor_id")
          .eq("store_id", storeId)
          .eq("is_bot", false)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) break;
        const batch = (data || []) as any[];
        for (const r of batch) {
          const k = r.session_id || r.visitor_id || "";
          if (k) uniq.add(k);
        }
        if (batch.length < PAGE) break;
      }
      return uniq.size;
    },
    enabled: !!storeId,
  });

  // Engagement quality for the selected range — server-side, and unlike the old
  // rollup-only read it also includes TODAY (rollups run nightly, so "Today" and
  // any range ending today previously showed 0% bounce / 0s duration).
  const { data: quality } = useQuery({
    queryKey: ["analytics-quality", storeId, rangeStart.toISOString(), rangeEnd.toISOString()],
    staleTime: 60_000,
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as RpcClient).rpc<Record<string, any>>(
        "get_analytics_quality",
        { _store_id: storeId, _range_start: rangeStart.toISOString(), _range_end: rangeEnd.toISOString() },
      );
      if (error) throw error;
      return data || {};
    },
  });

  // Funnel + drop-off diagnostics for the WHOLE selected range (server-side).
  // Previously the funnel mixed nightly rollups with a 200k-row browser fetch of
  // today's events, and diagnostics only ever described today.
  const { data: funnelData } = useQuery({
    queryKey: ["analytics-funnel", storeId, rangeStart.toISOString(), rangeEnd.toISOString()],
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as RpcClient).rpc<FunnelPayload>(
        "get_analytics_funnel",
        { _store_id: storeId, _range_start: rangeStart.toISOString(), _range_end: rangeEnd.toISOString() },
      );
      if (error) throw error;
      return data || {};
    },
  });

  const orderCounts = useMemo(() => ({
    created: Number(ordersBreakdown?.created ?? 0),
    paid: Number(ordersBreakdown?.paid ?? 0),
    cancelled: Number(ordersBreakdown?.cancelled ?? 0),
    pending: Number(ordersBreakdown?.pending ?? 0),
    paidNew: Number(ordersBreakdown?.paid_new ?? 0),
    paidRepeat: Number(ordersBreakdown?.paid_repeat ?? 0),
    revNew: Number(ordersBreakdown?.rev_new ?? 0),
    revRepeat: Number(ordersBreakdown?.rev_repeat ?? 0),
    sources: ((ordersBreakdown?.sources || []) as any[]).map((s) => ({
      source: String(s.source || "direct"),
      orders: Number(s.orders || 0),
      revenue: Number(s.revenue || 0),
    })),
  }), [ordersBreakdown]);



  // Cohorts
  const { data: cohorts } = useQuery({
    queryKey: ["cohorts", storeId],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_cohorts_monthly" as any)
        .select("cohort_month, period_offset, customers, returning_customers, revenue")
        .eq("store_id", storeId)
        .order("cohort_month", { ascending: false })
        .limit(120);
      return ((data as any[]) || []);
    },
    enabled: !!storeId,
  });

  // Derived metrics — all from the range-accurate server aggregate.
  const qualitySessions = Number(quality?.sessions ?? 0);
  const bounceRate = qualitySessions > 0
    ? (Number(quality?.bounce_sessions ?? 0) / qualitySessions) * 100 : 0;
  const pagesPerSession = qualitySessions > 0
    ? Number(quality?.pageviews ?? 0) / qualitySessions : 0;
  const avgDurationSec = Number(quality?.avg_duration_sec ?? 0);


  const sources = useMemo(() => {
    return (breakdowns?.sources || []).map((s) => ({
      name: String(s.name || "direct"),
      value: Number(s.value || 0),
    }));
  }, [breakdowns?.sources]);

  const countries = useMemo(() => {
    return (breakdowns?.countries || []).map((c) => ({
      name: String(c.name || "UNKNOWN"),
      value: Number(c.value || 0),
    }));
  }, [breakdowns?.countries]);

  const devices = useMemo(() => {
    return (breakdowns?.devices || []).map((d) => ({
      name: String(d.name || "unknown"),
      value: Number(d.value || 0),
    }));
  }, [breakdowns?.devices]);

  const funnel = useMemo(() => {
    const steps_ = (funnelData?.steps || {}) as Record<string, number>;
    const num = (k: string) => Number(steps_[k] || 0);

    // Entry step uses the exact de-duplicated session count for the range,
    // which also covers today (the rollup-only sum used to drop today entirely).
    const sessions = Number(rangeSessions || 0) || Number(quality?.sessions || 0);
    const created = orderCounts.created;
    const paid = orderCounts.paid;

    const steps = [
      { name: "Sessions",       value: sessions,               color: CHART_COLORS[6] },
      { name: "Product Views",  value: num("view_product"),    color: CHART_COLORS[0] },
      { name: "Add to Cart",    value: num("add_to_cart"),     color: CHART_COLORS[1] },
      { name: "Checkout",       value: num("begin_checkout"),  color: CHART_COLORS[3] },
      { name: "Pay Clicked",    value: num("pay_click"),       color: CHART_COLORS[4] },
      { name: "Order Created",  value: created,                color: CHART_COLORS[7] },
      { name: "Paid",           value: paid,                   color: CHART_COLORS[2] },
    ];
    const maxV = Math.max(...steps.map(s => s.value), 1);
    return steps.map((s, i) => ({
      ...s,
      width: (s.value / maxV) * 100,
      convFromTop: steps[0].value > 0 ? (s.value / steps[0].value) * 100 : 0,
      convFromPrev: i > 0 && steps[i - 1].value > 0
        ? (s.value / steps[i - 1].value) * 100
        : 100,
      dropOff: i > 0 && steps[i - 1].value > 0
        ? ((steps[i - 1].value - s.value) / steps[i - 1].value) * 100
        : 0,
    }));
  }, [funnelData, rangeSessions, quality, orderCounts]);

  // Diagnostics — actionable drop reasons for the SELECTED range (server-side).
  // Powers the "Why they didn't buy" card so the merchant sees a fix list,
  // not just a funnel shape.
  const diagnostics = useMemo(() => {
    const pairs = (rows?: KeyCount[]) =>
      (rows || []).map((r) => [String(r.key ?? "unknown"), Number(r.n || 0)] as [string, number]);
    return {
      fieldStops: pairs(funnelData?.field_stops),
      payFailReasons: pairs(funnelData?.pay_fail_reasons),
      zeroResultSearches: pairs(funnelData?.zero_result_searches),
      cartRemoves: pairs(funnelData?.cart_removes),
      variantSelectSessions: Number(funnelData?.variant_select_sessions || 0),
      pdpDeepScrollSessions: Number(funnelData?.pdp_deep_scroll_sessions || 0),
      attributedPct: Number(funnelData?.attributed_pct || 0),
    };
  }, [funnelData]);


  const cohortGrid = useMemo(() => {
    if (!cohorts || cohorts.length === 0) return { rows: [], maxOffset: 0 };
    const byCohort: Record<string, { customers: number; periods: Record<number, number> }> = {};
    let maxOffset = 0;
    cohorts.forEach((r: any) => {
      const m = r.cohort_month;
      if (!byCohort[m]) byCohort[m] = { customers: r.customers, periods: {} };
      byCohort[m].customers = Math.max(byCohort[m].customers, r.customers);
      byCohort[m].periods[r.period_offset] = r.returning_customers;
      if (r.period_offset > maxOffset) maxOffset = r.period_offset;
    });
    const rows = Object.entries(byCohort)
      .map(([month, data]) => ({ month, customers: data.customers, periods: data.periods }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);
    return { rows, maxOffset: Math.min(maxOffset, 11) };
  }, [cohorts]);

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${Math.round(sec)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-4">
      {/* Live visitors — always shown */}
      <Card className="border shadow-none bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-2.5 w-2.5 rounded-full bg-success" />
              <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-success animate-ping opacity-75" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Live visitors (last 5 min)</p>
              <p className="text-2xl font-bold text-foreground leading-tight">{liveCount ?? 0}</p>
            </div>
          </div>
          <Activity className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Quality metrics row */}
      <div className="grid grid-cols-3 gap-2.5">
        <MiniMetric label="Bounce" value={bounceRate.toFixed(1)} suffix="%" icon={TrendingDown} />
        <MiniMetric label="Pages/Session" value={pagesPerSession.toFixed(1)} icon={MousePointerClick} />
        <MiniMetric label="Avg Time" value={formatDuration(avgDurationSec)} icon={Timer} />
      </div>

      {/* Funnel */}
      <Card className="border shadow-none">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {funnel.some(f => f.value > 0) ? (
            <div className="space-y-2.5">
              {funnel.map((step, i) => (
                <div key={step.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium text-foreground truncate">{step.name}</span>
                    <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                      <span className="text-foreground font-semibold">{step.value.toLocaleString()}</span>
                      {i > 0 && (
                        <span className="ml-1.5">
                          {step.convFromPrev.toFixed(0)}% of prev
                        </span>
                      )}
                      {i > 0 && step.dropOff > 0 && (
                        <span className="ml-1.5 text-destructive">−{step.dropOff.toFixed(0)}%</span>
                      )}
                    </span>
                  </div>
                  <div className="h-6 w-full rounded bg-muted overflow-hidden relative">
                    <div
                      className="h-full rounded transition-all"
                      style={{ width: `${Math.max(step.width, 4)}%`, backgroundColor: step.color }}
                    />
                    {i > 0 && (
                      <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-muted-foreground">
                        {step.convFromTop.toFixed(1)}% of sessions
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(orderCounts?.cancelled ?? 0) > 0 && (
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-destructive font-medium">Cancelled / failed at payment</span>
                  <span className="tabular-nums text-destructive font-semibold">
                    {orderCounts!.cancelled} of {orderCounts!.created}
                    {orderCounts!.created > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({((orderCounts!.cancelled / orderCounts!.created) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No funnel data yet. Events will start appearing as customers browse.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Drop-off diagnostics — actionable "why they didn't buy" list */}
      {(diagnostics.fieldStops.length > 0 ||
        diagnostics.payFailReasons.length > 0 ||
        diagnostics.zeroResultSearches.length > 0 ||
        diagnostics.cartRemoves.length > 0) && (
        <Card className="border shadow-none">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" /> Why they didn&rsquo;t buy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2 space-y-3 text-xs">
            {diagnostics.payFailReasons.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Payment failure reasons</p>
                <ul className="space-y-0.5">
                  {diagnostics.payFailReasons.map(([reason, n]) => (
                    <li key={reason} className="flex justify-between">
                      <span className="text-foreground capitalize">{reason.replace(/_/g, " ")}</span>
                      <span className="tabular-nums font-semibold text-destructive">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diagnostics.fieldStops.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Checkout fields that stopped shoppers</p>
                <ul className="space-y-0.5">
                  {diagnostics.fieldStops.map(([field, n]) => (
                    <li key={field} className="flex justify-between">
                      <span className="text-foreground">{field}</span>
                      <span className="tabular-nums font-semibold">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diagnostics.zeroResultSearches.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Searches with zero results (add these products!)
                </p>
                <ul className="space-y-0.5">
                  {diagnostics.zeroResultSearches.map(([q, n]) => (
                    <li key={q} className="flex justify-between">
                      <span className="text-foreground truncate mr-2">"{q}"</span>
                      <span className="tabular-nums font-semibold">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diagnostics.cartRemoves.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Most-removed products from cart
                </p>
                <ul className="space-y-0.5">
                  {diagnostics.cartRemoves.map(([label, n]) => (
                    <li key={label} className="flex justify-between">
                      <span className="text-foreground truncate mr-2">{label}</span>
                      <span className="tabular-nums font-semibold">{n}</span>
                    </li>
                  ))}

                </ul>
              </div>
            )}
            <div className="pt-2 border-t border-border grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <p className="text-muted-foreground">Variant selected</p>
                <p className="font-semibold text-foreground">{diagnostics.variantSelectSessions} sessions</p>
              </div>
              <div>
                <p className="text-muted-foreground">Read PDP (75%+)</p>
                <p className="font-semibold text-foreground">{diagnostics.pdpDeepScrollSessions} sessions</p>
              </div>
              <div>
                <p className="text-muted-foreground">Attributed traffic</p>
                <p className="font-semibold text-foreground">{diagnostics.attributedPct.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New vs Repeat + Revenue by acquisition source */}
      {(orderCounts?.paid ?? 0) > 0 && (
        <Card className="border shadow-none">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm font-medium">New vs Repeat buyers</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">New buyers</p>
                <p className="text-lg font-semibold tabular-nums">{orderCounts?.paidNew ?? 0}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  ₹{Math.round(orderCounts?.revNew ?? 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Repeat buyers</p>
                <p className="text-lg font-semibold tabular-nums text-primary">{orderCounts?.paidRepeat ?? 0}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  ₹{Math.round(orderCounts?.revRepeat ?? 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            {(orderCounts?.sources?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Revenue by acquisition source
                </p>
                <ul className="space-y-0.5">
                  {orderCounts!.sources.slice(0, 6).map((s) => (
                    <li key={s.source} className="flex justify-between">
                      <span className="text-foreground capitalize">{s.source}</span>
                      <span className="tabular-nums font-semibold">
                        {s.orders} · ₹{Math.round(s.revenue).toLocaleString("en-IN")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Traffic sources + Devices */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="border shadow-none">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <Megaphone className="h-3 w-3" /> Traffic Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            {sources.length > 0 ? (
              <div className="space-y-1.5">
                {sources.slice(0, 6).map((s, i) => {
                  const max = sources[0]?.value || 1;
                  const pct = (s.value / max) * 100;
                  return (
                    <div key={s.name} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="capitalize text-foreground truncate">{s.name}</span>
                        <span className="text-muted-foreground">{s.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-[10px] text-muted-foreground">No source data</p>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <Smartphone className="h-3 w-3" /> Devices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            {devices.length > 0 && devices.some(d => d.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={devices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={2}>
                      {devices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {devices.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="capitalize">{d.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-[10px] text-muted-foreground">No device data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Geography */}
      <Card className="border shadow-none">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Top Countries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {countries.length > 0 && countries.some(c => c.name !== "UNKNOWN") ? (
            <ResponsiveContainer width="100%" height={Math.max(160, countries.length * 22)}>
              <BarChart data={countries} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={40} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Country data collection just started. Check back in a day.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cohort retention */}
      <Card className="border shadow-none">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <RefreshCcw className="h-3.5 w-3.5" /> Customer Retention by Cohort
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2 overflow-x-auto">
          {cohortGrid.rows.length > 0 ? (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left pb-1 pr-2 font-medium">Cohort</th>
                  <th className="text-right pb-1 px-1 font-medium">Size</th>
                  {Array.from({ length: cohortGrid.maxOffset + 1 }, (_, i) => (
                    <th key={i} className="text-right pb-1 px-1 font-medium">M{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortGrid.rows.map(row => (
                  <tr key={row.month} className="border-t border-border">
                    <td className="py-1 pr-2 font-medium whitespace-nowrap">
                      {format(parseISO(row.month), "MMM yy")}
                    </td>
                    <td className="text-right py-1 px-1 text-muted-foreground">{row.customers}</td>
                    {Array.from({ length: cohortGrid.maxOffset + 1 }, (_, i) => {
                      const v = row.periods[i] || 0;
                      const pct = row.customers > 0 ? (v / row.customers) * 100 : 0;
                      const bgIntensity = Math.min(pct / 100, 1);
                      return (
                        <td
                          key={i}
                          className="text-right py-1 px-1 text-foreground"
                          style={{ backgroundColor: v > 0 ? `hsl(var(--primary) / ${0.1 + bgIntensity * 0.5})` : "transparent" }}
                        >
                          {v > 0 ? `${pct.toFixed(0)}%` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Retention chart needs at least 1 month of order history.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
