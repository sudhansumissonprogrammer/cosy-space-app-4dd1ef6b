import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type KPI = {
  sent_24h: number; sent_7d: number;
  delivered_pct: number; read_pct: number; reply_pct: number;
  recovered_orders_30d: number; recovered_revenue_30d: number;
  campaign_runs_30d: number; failed_24h: number; queue_depth: number;
};

export function AdminPlatformAnalyticsTab() {
  const [k, setK] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_wa_platform_kpis" as any);
      if (!error && data) setK((data as any) as KPI);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!k) return <div className="text-sm text-muted-foreground">No data yet.</div>;

  const Cell = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Cell label="Sent · 24h" value={k.sent_24h} />
        <Cell label="Sent · 7d" value={k.sent_7d} />
        <Cell label="Failed · 24h" value={k.failed_24h} />
        <Cell label="Queue depth" value={k.queue_depth} />
        <Cell label="Delivered %" value={`${k.delivered_pct.toFixed(1)}%`} />
        <Cell label="Read %" value={`${k.read_pct.toFixed(1)}%`} />
        <Cell label="Reply %" value={`${k.reply_pct.toFixed(1)}%`} />
        <Cell label="Campaigns · 30d" value={k.campaign_runs_30d} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cart recovery · 30 days</CardTitle>
          <CardDescription>Orders attributed to a platform WhatsApp recovery message.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Cell label="Recovered orders" value={k.recovered_orders_30d} />
          <Cell label="Recovered revenue" value={`₹${Number(k.recovered_revenue_30d || 0).toLocaleString("en-IN")}`} />
        </CardContent>
      </Card>
    </div>
  );
}
