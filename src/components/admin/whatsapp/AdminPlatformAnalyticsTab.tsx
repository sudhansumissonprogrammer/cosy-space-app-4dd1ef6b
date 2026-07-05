import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, MessageSquare, Store } from "lucide-react";
import { format, parseISO } from "date-fns";

type Analytics = {
  window_days: number;
  totals: { sent: number; delivered: number; read_cnt: number; failed: number; replied: number; sent_24h: number; failed_24h: number };
  daily: Array<{ day: string; sent: number; delivered: number; read_cnt: number; failed: number }>;
  by_type: Array<{ type: string; sent: number; delivered: number; read_cnt: number; failed: number }>;
  by_store: Array<{ store_id: string | null; store_name: string; store_slug: string | null; sent: number; delivered: number; read_cnt: number; failed: number; replied: number }>;
  by_template: Array<{ template: string; sent: number; delivered: number; read_cnt: number; failed: number; replied: number }>;
  failures: Array<{ reason: string; n: number }>;
  recovery: { orders: number; revenue: number };
  queue_depth: number;
  health: { wa_quality_rating: string | null; wa_messaging_tier: string | null; wa_tier_limit: number | null; wa_meta_breaker: boolean | null } | null;
};

const pct = (num: number, den: number) => den > 0 ? ((num / den) * 100) : 0;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtInt = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-IN");
const fmtINR = (n: number | null | undefined) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function AdminPlatformAnalyticsTab() {
  const [days, setDays] = useState(7);
  const [syncing, setSyncing] = useState(false);
  const [meta, setMeta] = useState<any>(null);

  const { data: a, isLoading, error, refetch } = useQuery({
    queryKey: ["wa-analytics-v2", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_wa_analytics_v2" as any, { _days: days });
      if (error) throw error;
      return data as unknown as Analytics;
    },
    refetchInterval: 60000,
    retry: 1,
  });

  const syncMeta = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-meta-insights");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setMeta(data);
      refetch();
      toast({ title: "Synced with Meta", description: `Quality: ${(data as any)?.phone?.quality_rating || "—"}` });
    } catch (e: any) {
      toast({ title: "Meta sync failed", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  useEffect(() => { syncMeta(); /* eslint-disable-next-line */ }, []);

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading analytics…</div>;
  if (error) return (
    <div className="p-4 space-y-2">
      <div className="text-sm font-medium text-red-600">Failed to load analytics</div>
      <div className="text-xs text-muted-foreground break-all">{(error as any)?.message || String(error)}</div>
      <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
    </div>
  );
  if (!a || !a.totals) return (
    <div className="p-4 space-y-2">
      <div className="text-sm text-muted-foreground">No data yet.</div>
      <Button size="sm" variant="outline" onClick={() => refetch()}>Reload</Button>
    </div>
  );

  const t = a.totals;
  const deliveredPct = pct(t.delivered, t.sent);
  const readPct = pct(t.read_cnt, t.sent);
  const failedPct = pct(t.failed, t.sent);
  const replyPct = pct(t.replied, t.sent);

  const qualityColor = (q: string | null | undefined) =>
    q === "GREEN" ? "text-emerald-600" : q === "YELLOW" ? "text-amber-600" : q === "RED" ? "text-red-600" : "text-muted-foreground";

  const dailyFmt = (a.daily || []).map(d => ({ ...d, label: format(parseISO(d.day), "MMM d") }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">WhatsApp Analytics</h2>
          <p className="text-xs text-muted-foreground">Platform-wide messaging insights · live from database & Meta</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList className="h-8">
              <TabsTrigger value="1" className="text-xs px-2">24h</TabsTrigger>
              <TabsTrigger value="7" className="text-xs px-2">7d</TabsTrigger>
              <TabsTrigger value="30" className="text-xs px-2">30d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs px-2">90d</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={syncMeta} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            Sync Meta
          </Button>
        </div>
      </div>

      {/* Health strip */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Quality rating</p>
            <p className={`text-xl font-semibold mt-0.5 ${qualityColor(a.health?.wa_quality_rating || meta?.phone?.quality_rating)}`}>
              {a.health?.wa_quality_rating || meta?.phone?.quality_rating || "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Messaging tier</p>
            <p className="text-xl font-semibold mt-0.5">{meta?.phone?.messaging_limit_tier || a.health?.wa_messaging_tier || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{a.health?.wa_tier_limit ? `${fmtInt(a.health.wa_tier_limit)} / 24h cap` : ""}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Verified name</p>
            <p className="text-sm font-medium mt-0.5 truncate">{meta?.phone?.verified_name || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{meta?.phone?.name_status || ""}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Templates approved</p>
            <p className="text-xl font-semibold mt-0.5">{meta?.templates?.by_status?.APPROVED ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">{meta?.templates?.total ? `of ${meta.templates.total}` : ""}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Circuit breaker</p>
            <p className={`text-sm font-medium mt-0.5 flex items-center gap-1 ${a.health?.wa_meta_breaker ? "text-red-600" : "text-emerald-600"}`}>
              {a.health?.wa_meta_breaker ? <><AlertTriangle className="h-4 w-4"/> Tripped</> : <><CheckCircle2 className="h-4 w-4"/> Healthy</>}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Kpi label={`Sent · ${days}d`}     value={fmtInt(t.sent)} icon={<MessageSquare className="h-3.5 w-3.5" />} />
        <Kpi label="Sent · 24h"            value={fmtInt(t.sent_24h)} />
        <Kpi label="Delivered"             value={fmtPct(deliveredPct)} sub={`${fmtInt(t.delivered)} msgs`} tone="emerald" />
        <Kpi label="Read"                  value={fmtPct(readPct)}      sub={`${fmtInt(t.read_cnt)} msgs`} tone="blue" />
        <Kpi label="Replied"               value={fmtPct(replyPct)}     sub={`${fmtInt(t.replied)} msgs`} tone="violet" />
        <Kpi label="Failed"                value={fmtPct(failedPct)}    sub={`${fmtInt(t.failed)} msgs`} tone={failedPct > 5 ? "red" : "muted"} />
        <Kpi label="Queue depth"           value={fmtInt(a.queue_depth)} sub="pending / in-flight" />
        <Kpi label="Recovered · 30d"       value={fmtINR(a.recovery?.revenue)} sub={`${fmtInt(a.recovery?.orders)} orders`} tone="emerald" icon={<TrendingUp className="h-3.5 w-3.5"/>} />
      </div>

      {/* Daily trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Message trend</CardTitle>
          <CardDescription>Sent · delivered · read · failed per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyFmt}>
                <defs>
                  <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.35}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gRead" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="label" fontSize={11}/>
                <YAxis fontSize={11}/>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Area type="monotone" dataKey="sent"       name="Sent"      stroke="#10b981" fill="url(#gSent)" strokeWidth={2}/>
                <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#6366f1" fill="transparent" strokeWidth={2}/>
                <Area type="monotone" dataKey="read_cnt"  name="Read"      stroke="#3b82f6" fill="url(#gRead)" strokeWidth={2}/>
                <Area type="monotone" dataKey="failed"    name="Failed"    stroke="#ef4444" fill="transparent" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By message type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.by_type} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                  <XAxis type="number" fontSize={11}/>
                  <YAxis type="category" dataKey="type" fontSize={11} width={120}/>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                  <Bar dataKey="sent"      stackId="a" fill="#10b981" name="Sent"/>
                  <Bar dataKey="failed"    stackId="a" fill="#ef4444" name="Failed"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Failures */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500"/> Top failure reasons</CardTitle>
          </CardHeader>
          <CardContent>
            {a.failures.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">🎉 No failures in this window</p>
            ) : (
              <div className="space-y-2">
                {a.failures.map((f, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <span className="flex-1 text-muted-foreground break-words whitespace-normal leading-snug" title={f.reason}>{f.reason}</span>
                    <Badge variant="destructive" className="shrink-0">{f.n}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Store leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4"/> Top stores</CardTitle>
          <CardDescription>Sends & performance per store in the selected window</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                <th className="py-2 pr-3">Store</th>
                <th className="py-2 px-3 text-right">Sent</th>
                <th className="py-2 px-3 text-right">Delivered</th>
                <th className="py-2 px-3 text-right">Read</th>
                <th className="py-2 px-3 text-right">Replied</th>
                <th className="py-2 pl-3 text-right">Failed</th>
              </tr>
            </thead>
            <tbody>
              {a.by_store.map((s, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{s.store_name}</div>
                    {s.store_slug && <div className="text-[11px] text-muted-foreground">/{s.store_slug}</div>}
                  </td>
                  <td className="py-2 px-3 text-right font-medium">{fmtInt(s.sent)}</td>
                  <td className="py-2 px-3 text-right">{fmtInt(s.delivered)} <span className="text-[10px] text-muted-foreground">({fmtPct(pct(s.delivered, s.sent))})</span></td>
                  <td className="py-2 px-3 text-right">{fmtInt(s.read_cnt)} <span className="text-[10px] text-muted-foreground">({fmtPct(pct(s.read_cnt, s.sent))})</span></td>
                  <td className="py-2 px-3 text-right">{fmtInt(s.replied)}</td>
                  <td className="py-2 pl-3 text-right">
                    {s.failed > 0
                      ? <Badge variant="destructive" className="text-[10px]">{s.failed}</Badge>
                      : <span className="text-muted-foreground">0</span>}
                  </td>
                </tr>
              ))}
              {a.by_store.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No sends yet in this window</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Template performance */}
      {a.by_template.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Template performance</CardTitle>
            <CardDescription>How each Meta-approved template is performing</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2 pr-3">Template</th>
                  <th className="py-2 px-3 text-right">Sent</th>
                  <th className="py-2 px-3 text-right">Delivered %</th>
                  <th className="py-2 px-3 text-right">Read %</th>
                  <th className="py-2 px-3 text-right">Reply %</th>
                  <th className="py-2 pl-3 text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {a.by_template.map((t, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3 font-mono text-[12px]">{t.template}</td>
                    <td className="py-2 px-3 text-right font-medium">{fmtInt(t.sent)}</td>
                    <td className="py-2 px-3 text-right">{fmtPct(pct(t.delivered, t.sent))}</td>
                    <td className="py-2 px-3 text-right">{fmtPct(pct(t.read_cnt, t.sent))}</td>
                    <td className="py-2 px-3 text-right">{fmtPct(pct(t.replied, t.sent))}</td>
                    <td className="py-2 pl-3 text-right">{t.failed > 0 ? <Badge variant="destructive" className="text-[10px]">{t.failed}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone, icon }: { label: string; value: string | number; sub?: string; tone?: "emerald"|"blue"|"red"|"violet"|"muted"; icon?: React.ReactNode }) {
  const toneCls = tone === "emerald" ? "text-emerald-600"
    : tone === "blue"    ? "text-blue-600"
    : tone === "red"     ? "text-red-600"
    : tone === "violet"  ? "text-violet-600"
    : "";
  return (
    <Card><CardContent className="p-3">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-xl font-semibold mt-1 ${toneCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent></Card>
  );
}
