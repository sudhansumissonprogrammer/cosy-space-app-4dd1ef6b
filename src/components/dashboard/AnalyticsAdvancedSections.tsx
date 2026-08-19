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
import { subDays, parseISO, format, startOfMonth, differenceInMonths } from "date-fns";

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
}

interface AnalyticsBreakdownsPayload {
  sources?: Array<{ name: string; value: number | string }>;
  countries?: Array<{ name: string; value: number | string }>;
  devices?: Array<{ name: string; value: number | string }>;
}

export default function AnalyticsAdvancedSections({ storeId, rangeStart, rangeEnd, breakdowns }: Props) {
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

  // Page-views daily for bounce/duration metrics
  const { data: pvDaily } = useQuery({
    queryKey: ["pv-daily-ext", storeId, rangeStart.toISOString(), rangeEnd.toISOString()],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("page_views_daily")
        .select("date, pageviews, sessions, visitors, bounce_sessions, total_session_duration_seconds")
        .eq("store_id", storeId)
        .gte("date", format(rangeStart, "yyyy-MM-dd"))
        .lte("date", format(rangeEnd, "yyyy-MM-dd"))
        .order("date", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });

  // Funnel events daily
  const { data: funnelDaily } = useQuery({
    queryKey: ["funnel-daily", storeId, rangeStart.toISOString(), rangeEnd.toISOString()],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("storefront_events_daily" as any)
        .select("date, event_name, count, unique_sessions, value_sum")
        .eq("store_id", storeId)
        .gte("date", format(rangeStart, "yyyy-MM-dd"))
        .lte("date", format(rangeEnd, "yyyy-MM-dd"));
      return ((data as any[]) || []);
    },
    enabled: !!storeId,
  });

  // Today's funnel from raw events (since rollup runs nightly)
  const { data: funnelToday } = useQuery({
    queryKey: ["funnel-today", storeId],
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // Paginate today's events so funnels stay accurate on high-volume stores.
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const PAGE = 1000;
      const rows: any[] = [];
      for (let from = 0; from < 200_000; from += PAGE) {
        const { data, error } = await (supabase as any)
          .from("storefront_events")
          .select("event_name, session_id, value, metadata")
          .eq("store_id", storeId)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) break;
        const batch = (data || []) as any[];
        rows.push(...batch);
        if (batch.length < PAGE) break;
      }
      return rows;
    },
    enabled: !!storeId,
  });

  // Orders in range — created / paid / cancelled counts feed the tail of the funnel.
  // Paid statuses mirror firePurchaseCapi.ts so partial-paid counts as revenue.
  const { data: orderCounts } = useQuery({
    queryKey: ["funnel-orders", storeId, rangeStart.toISOString(), rangeEnd.toISOString()],
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("status, is_repeat_customer, attribution, total")
        .eq("store_id", storeId)
        .gte("created_at", rangeStart.toISOString())
        .lte("created_at", rangeEnd.toISOString());
      const rows = (data || []) as any[];
      const PAID = new Set(["paid", "confirmed", "partially_paid", "delivered", "completed", "shipped"]);
      let created = rows.length;
      let paid = 0, cancelled = 0, pending = 0;
      let paidNew = 0, paidRepeat = 0;
      let revNew = 0, revRepeat = 0;
      const srcMap = new Map<string, { orders: number; revenue: number }>();
      for (const r of rows) {
        const s = String(r.status || "").toLowerCase();
        const isPaid = PAID.has(s);

        if (s === "cancelled" || s === "failed") cancelled++;
        else if (isPaid) paid++;
        else pending++;
        if (isPaid) {
          const rev = Number(r.total || 0);
          if (r.is_repeat_customer) { paidRepeat++; revRepeat += rev; }
          else { paidNew++; revNew += rev; }
          const attr = r.attribution || {};
          const src =
            attr.utm_source ||
            (attr.fbclid ? "meta-ad" : null) ||
            (attr.gclid ? "google-ad" : null) ||
            (attr.ttclid ? "tiktok-ad" : null) ||
            (attr.referrer ? "referral" : "direct");
          const key = String(src).slice(0, 40).toLowerCase();
          const cur = srcMap.get(key) || { orders: 0, revenue: 0 };
          cur.orders++; cur.revenue += rev;
          srcMap.set(key, cur);
        }
      }
      const sources = Array.from(srcMap.entries())
        .map(([source, v]) => ({ source, ...v }))
        .sort((a, b) => b.revenue - a.revenue);
      return { created, paid, cancelled, pending, paidNew, paidRepeat, revNew, revRepeat, sources };
    },
    enabled: !!storeId,
  });


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

  // Derived metrics
  const bounceRate = useMemo(() => {
    const sessions = (pvDaily || []).reduce((s, r) => s + (r.sessions || 0), 0);
    const bounces = (pvDaily || []).reduce((s, r) => s + (r.bounce_sessions || 0), 0);
    return sessions > 0 ? (bounces / sessions) * 100 : 0;
  }, [pvDaily]);

  const pagesPerSession = useMemo(() => {
    const sessions = (pvDaily || []).reduce((s, r) => s + (r.sessions || 0), 0);
    const pv = (pvDaily || []).reduce((s, r) => s + (r.pageviews || 0), 0);
    return sessions > 0 ? pv / sessions : 0;
  }, [pvDaily]);

  const avgDurationSec = useMemo(() => {
    const sessions = (pvDaily || []).reduce((s, r) => s + (r.sessions || 0), 0);
    const dur = (pvDaily || []).reduce((s, r) => s + (r.total_session_duration_seconds || 0), 0);
    return sessions > 0 ? dur / sessions : 0;
  }, [pvDaily]);

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
    const map: Record<string, number> = {
      view_product: 0, add_to_cart: 0, begin_checkout: 0, pay_click: 0, purchase: 0,
    };
    (funnelDaily || []).forEach((r: any) => {
      if (map[r.event_name] !== undefined) map[r.event_name] += r.unique_sessions || 0;
    });
    // Today's raw events (rollup runs nightly, so append today's unique sessions).
    const todayBySession: Record<string, Set<string>> = {
      view_product: new Set(), add_to_cart: new Set(),
      begin_checkout: new Set(), pay_click: new Set(), purchase: new Set(),
    };
    (funnelToday || []).forEach((e: any) => {
      if (todayBySession[e.event_name]) todayBySession[e.event_name].add(e.session_id || "");
    });
    Object.keys(map).forEach(k => { map[k] += todayBySession[k].size; });

    const sessions = (pvDaily || []).reduce((s: number, r: any) => s + (r.sessions || 0), 0);
    const created = orderCounts?.created || 0;
    const paid = orderCounts?.paid || 0;

    const steps = [
      { name: "Sessions",       value: sessions,           color: CHART_COLORS[6] },
      { name: "Product Views",  value: map.view_product,   color: CHART_COLORS[0] },
      { name: "Add to Cart",    value: map.add_to_cart,    color: CHART_COLORS[1] },
      { name: "Checkout",       value: map.begin_checkout, color: CHART_COLORS[3] },
      { name: "Pay Clicked",    value: map.pay_click,      color: CHART_COLORS[4] },
      { name: "Order Created",  value: created,            color: CHART_COLORS[7] },
      { name: "Paid",           value: paid,               color: CHART_COLORS[2] },
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
  }, [funnelDaily, funnelToday, pvDaily, orderCounts]);

  // Diagnostics — mines today's raw events for actionable drop reasons.
  // Powers the "Why they didn't buy" card so the merchant sees a fix list,
  // not just a funnel shape.
  const diagnostics = useMemo(() => {
    const rows = (funnelToday || []) as any[];
    const fieldStops: Record<string, number> = {};
    const payFailReasons: Record<string, number> = {};
    const zeroResultSearches: Record<string, number> = {};
    const variantSelects = new Set<string>();
    const pdpDeepScrolls = new Set<string>();
    const cartRemoves: Record<string, number> = {};
    const attributedSessions = new Set<string>();
    const allSessions = new Set<string>();

    for (const r of rows) {
      const md = r.metadata || {};
      const sid = r.session_id || "";
      if (sid) allSessions.add(sid);
      if (sid && (md.fbclid || md.gclid || md.ttclid || md.msclkid || md.utm_source)) {
        attributedSessions.add(sid);
      }
      switch (r.event_name) {
        case "checkout_field_error": {
          const f = String(md.field || "unknown");
          fieldStops[f] = (fieldStops[f] || 0) + 1;
          break;
        }
        case "payment_failed": {
          const reason = String(md.reason || md.payu_status || "unknown");
          payFailReasons[reason] = (payFailReasons[reason] || 0) + 1;
          break;
        }
        case "search_no_results": {
          const q = String(md.query || "").trim().slice(0, 40);
          if (q) zeroResultSearches[q] = (zeroResultSearches[q] || 0) + 1;
          break;
        }
        case "pdp_variant_select": if (sid) variantSelects.add(sid); break;
        case "pdp_deep_scroll":   if (sid) pdpDeepScrolls.add(sid); break;
        case "cart_remove": {
          const pid = String(r.product_id || md.productId || "unknown");
          cartRemoves[pid] = (cartRemoves[pid] || 0) + 1;
          break;
        }
      }
    }

    const top = (obj: Record<string, number>, n = 5) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

    return {
      fieldStops: top(fieldStops),
      payFailReasons: top(payFailReasons),
      zeroResultSearches: top(zeroResultSearches),
      cartRemoves: top(cartRemoves),
      variantSelectSessions: variantSelects.size,
      pdpDeepScrollSessions: pdpDeepScrolls.size,
      attributedPct: allSessions.size > 0 ? (attributedSessions.size / allSessions.size) * 100 : 0,
    };
  }, [funnelToday]);

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
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
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
              <TrendingDown className="h-3.5 w-3.5 text-destructive" /> Why they didn't buy (today)
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
                  {diagnostics.cartRemoves.map(([pid, n]) => (
                    <li key={pid} className="flex justify-between">
                      <span className="text-foreground truncate mr-2 font-mono text-[10px]">{pid.slice(0, 8)}…</span>
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
            <CardTitle className="text-sm font-medium">New vs Repeat buyers (today)</CardTitle>
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
