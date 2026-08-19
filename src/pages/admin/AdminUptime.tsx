import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Gauge, RefreshCw, Search, ShieldAlert, Zap,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Target {
  id: string;
  target_key: string;
  label: string;
  url: string;
  kind: string;
  enabled: boolean;
  state: string;
  consecutive_failures: number;
  last_checked_at: string | null;
  last_status: number | null;
  last_latency_ms: number | null;
  last_error: string | null;
}

interface Incident {
  id: string;
  label: string | null;
  url: string | null;
  started_at: string;
  resolved_at: string | null;
  last_error: string | null;
  alerted: boolean;
}

const KIND_LABEL: Record<string, string> = {
  storefront: "Storefront",
  platform: "Platform",
  api: "Core service",
  signal: "Business signal",
};

function latencyTone(ms: number | null) {
  if (ms == null) return "text-muted-foreground";
  if (ms < 800) return "text-emerald-600";
  if (ms < 2500) return "text-amber-600";
  return "text-red-600";
}

export default function AdminUptime() {
  useDocumentTitle("Uptime Monitor · Admin");
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);

  const targetsQ = useQuery({
    queryKey: ["admin-uptime-targets"],
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uptime_targets")
        .select("*")
        .order("state", { ascending: false })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Target[];
    },
  });

  const incidentsQ = useQuery({
    queryKey: ["admin-uptime-incidents"],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uptime_incidents")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Incident[];
    },
  });

  const targets = targetsQ.data ?? [];
  const incidents = incidentsQ.data ?? [];

  const filtered = useMemo(
    () =>
      targets.filter(
        (t) =>
          !search ||
          t.label.toLowerCase().includes(search.toLowerCase()) ||
          t.url.toLowerCase().includes(search.toLowerCase()),
      ),
    [targets, search],
  );

  const down = targets.filter((t) => t.state === "down");
  const probed = targets.filter((t) => t.kind !== "signal" && t.last_latency_ms != null);
  const avgLatency = probed.length
    ? Math.round(probed.reduce((a, t) => a + (t.last_latency_ms || 0), 0) / probed.length)
    : 0;
  const slowest = [...probed].sort((a, b) => (b.last_latency_ms || 0) - (a.last_latency_ms || 0)).slice(0, 5);
  const openIncidents = incidents.filter((i) => !i.resolved_at);

  const runNow = async () => {
    setRunning(true);
    try {
      await Promise.all([
        supabase.functions.invoke("uptime-monitor", { body: { sync: true } }),
        supabase.functions.invoke("health-signals", { body: {} }),
      ]);
      toast.success("Health sweep triggered");
      setTimeout(() => {
        targetsQ.refetch();
        incidentsQ.refetch();
      }, 4000);
    } catch {
      toast.error("Could not trigger the sweep");
    } finally {
      setRunning(false);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, Target[]> = {};
    for (const t of filtered) (g[t.kind] ||= []).push(t);
    return g;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Uptime Monitor
          </h1>
          <p className="text-sm text-muted-foreground">
            Every storefront and core service is checked every minute. Business signals every 5 minutes.
            Alerts go to WhatsApp instantly.
          </p>
        </div>
        <Button onClick={runNow} disabled={running} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Run check now
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {down.length ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              Overall status
            </div>
            <div className={`text-2xl font-bold ${down.length ? "text-red-600" : "text-emerald-600"}`}>
              {down.length ? `${down.length} down` : "All systems normal"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gauge className="h-4 w-4" /> Monitored checks
            </div>
            <div className="text-2xl font-bold">{targets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" /> Avg response
            </div>
            <div className={`text-2xl font-bold ${latencyTone(avgLatency)}`}>{avgLatency} ms</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Open incidents
            </div>
            <div className={`text-2xl font-bold ${openIncidents.length ? "text-red-600" : ""}`}>
              {openIncidents.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {down.length > 0 && (
        <Card className="border-red-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-600 text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Currently failing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {down.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50/60 p-3">
                <div className="min-w-0">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground break-all">{t.url}</div>
                </div>
                <div className="text-xs text-red-700 max-w-full sm:max-w-[45%] break-words">{t.last_error}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Slowest right now</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {slowest.length === 0 && <p className="text-sm text-muted-foreground">No latency data yet.</p>}
          {slowest.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{t.label}</span>
              <span className={`font-mono ${latencyTone(t.last_latency_ms)}`}>{t.last_latency_ms} ms</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search store or service..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {targetsQ.isLoading && <Skeleton className="h-40 w-full" />}

      {Object.entries(grouped).map(([kind, list]) => (
        <Card key={kind}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {KIND_LABEL[kind] || kind}{" "}
              <span className="text-muted-foreground font-normal">({list.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {list.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b last:border-0 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      t.state === "down" ? "bg-red-500" : t.consecutive_failures > 0 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {t.kind === "signal" ? t.last_error || "Healthy" : t.url}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {t.last_status != null && <Badge variant="outline">{t.last_status}</Badge>}
                  {t.last_latency_ms != null && (
                    <span className={`font-mono ${latencyTone(t.last_latency_ms)}`}>{t.last_latency_ms} ms</span>
                  )}
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t.last_checked_at ? formatDistanceToNow(new Date(t.last_checked_at), { addSuffix: true }) : "never"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Incident history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {incidents.length === 0 && <p className="text-sm text-muted-foreground">No incidents recorded yet.</p>}
          {incidents.map((i) => {
            const mins = Math.max(
              1,
              Math.round(
                ((i.resolved_at ? new Date(i.resolved_at).getTime() : Date.now()) -
                  new Date(i.started_at).getTime()) / 60000,
              ),
            );
            return (
              <div key={i.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">{i.label}</span>
                  <Badge variant={i.resolved_at ? "secondary" : "destructive"}>
                    {i.resolved_at ? `Resolved · ${mins} min` : `Ongoing · ${mins} min`}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(i.started_at), "dd MMM yyyy, HH:mm")} · {i.last_error}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
