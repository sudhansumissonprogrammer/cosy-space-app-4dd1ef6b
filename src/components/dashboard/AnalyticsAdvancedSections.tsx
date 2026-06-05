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

function classifyReferrer(ref: string | null, utm_source: string | null): string {
  if (utm_source) return utm_source.toLowerCase();
  if (!ref) return "direct";
  try {
    const h = new URL(ref).hostname.toLowerCase();
    if (/google\./.test(h)) return "google";
    if (/facebook\.|fb\./.test(h)) return "facebook";
    if (/instagram\./.test(h)) return "instagram";
    if (/youtube\./.test(h)) return "youtube";
    if (/whatsapp\./.test(h) || /wa\.me/.test(h)) return "whatsapp";
    if (/bing\./.test(h)) return "bing";
    if (/t\.co|twitter\.|x\.com/.test(h)) return "twitter";
    return h.replace(/^www\./, "");
  } catch {
    return "referral";
  }
}

interface Props {
  storeId: string;
  rangeStart: Date;
  rangeEnd: Date;
  totalSessions: number;
  sym: string;
}

export default function AnalyticsAdvancedSections({ storeId, rangeStart, rangeEnd, totalSessions, sym }: Props) {
  // Live visitors — last 5 min, refetched every 20s
  const { data: liveCount } = useQuery({
    queryKey: ["live-visitors", storeId],
    refetchInterval: 20_000,
    staleTime: 15_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data } = await supabase
        .from("page_views")
        .select("session_id, visitor_id")
        .eq("store_id", storeId)
        .eq("is_bot", false)
        .gte("created_at", since)
        .limit(2000);
      const uniq = new Set((data || []).map((r: any) => r.session_id || r.visitor_id || ""));
      uniq.delete("");
      return uniq.size;
    },
    enabled: !!storeId,
  });

  // Raw views in range with new dimensions
  const { data: dimViews } = useQuery({
    queryKey: ["dim-views", storeId, rangeStart.toISOString(), rangeEnd.toISOString()],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const start = rangeStart.toISOString();
      const end = rangeEnd.toISOString();
      const { data } = await supabase
        .from("page_views")
        .select("referrer, utm_source, country, device, browser, session_id")
        .eq("store_id", storeId)
        .eq("is_bot", false)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(20000);
      return (data || []) as any[];
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
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("storefront_events" as any)
        .select("event_name, session_id, value")
        .eq("store_id", storeId)
        .gte("created_at", since.toISOString())
        .limit(10000);
      return ((data as any[]) || []);
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
    const map: Record<string, number> = {};
    (dimViews || []).forEach((v: any) => {
      const key = classifyReferrer(v.referrer, v.utm_source);
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [dimViews]);

  const countries = useMemo(() => {
    const map: Record<string, number> = {};
    (dimViews || []).forEach((v: any) => {
      const c = (v.country || "Unknown").toUpperCase();
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [dimViews]);

  const devices = useMemo(() => {
    const map: Record<string, number> = {};
    (dimViews || []).forEach((v: any) => {
      const d = v.device || "unknown";
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [dimViews]);

  const funnel = useMemo(() => {
    const map: Record<string, number> = { view_product: 0, add_to_cart: 0, begin_checkout: 0, purchase: 0 };
    (funnelDaily || []).forEach((r: any) => {
      if (map[r.event_name] !== undefined) map[r.event_name] += r.unique_sessions || 0;
    });
    // Add today's raw events (group by event_name → unique sessions)
    const todayBySession: Record<string, Set<string>> = {
      view_product: new Set(), add_to_cart: new Set(),
      begin_checkout: new Set(), purchase: new Set(),
    };
    (funnelToday || []).forEach((e: any) => {
      if (todayBySession[e.event_name]) todayBySession[e.event_name].add(e.session_id || "");
    });
    Object.keys(map).forEach(k => { map[k] += todayBySession[k].size; });

    const steps = [
      { name: "Product View", value: map.view_product, color: CHART_COLORS[0] },
      { name: "Add to Cart", value: map.add_to_cart, color: CHART_COLORS[1] },
      { name: "Checkout", value: map.begin_checkout, color: CHART_COLORS[3] },
      { name: "Purchase", value: map.purchase, color: CHART_COLORS[2] },
    ];
    const maxV = Math.max(...steps.map(s => s.value), 1);
    return steps.map((s, i) => ({
      ...s,
      width: (s.value / maxV) * 100,
      dropOff: i > 0 && steps[i - 1].value > 0
        ? ((steps[i - 1].value - s.value) / steps[i - 1].value) * 100
        : 0,
    }));
  }, [funnelDaily, funnelToday]);

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
            <div className="space-y-2">
              {funnel.map((step, i) => (
                <div key={step.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{step.name}</span>
                    <span className="text-muted-foreground">
                      {step.value.toLocaleString()}
                      {i > 0 && step.dropOff > 0 && (
                        <span className="ml-1.5 text-destructive">−{step.dropOff.toFixed(0)}%</span>
                      )}
                    </span>
                  </div>
                  <div className="h-6 w-full rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded transition-all flex items-center justify-end pr-2 text-[10px] font-medium text-primary-foreground"
                      style={{ width: `${Math.max(step.width, 4)}%`, backgroundColor: step.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No funnel data yet. Events will start appearing as customers browse.
            </p>
          )}
        </CardContent>
      </Card>

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
