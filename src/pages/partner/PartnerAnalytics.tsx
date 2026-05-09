import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, IndianRupee, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function PartnerAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: res } = await supabase.functions.invoke("partner-analytics", { body: {} });
      if (res) setData(res);
      setLoading(false);
    })();
  }, []);

  if (loading || !data) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const { funnel, subscriptions, earnings_series } = data;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{fmt(subscriptions.mrr)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">From your referred stores</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Active subscriptions</p>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{subscriptions.active}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Churned</p>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{subscriptions.churned}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Earnings (last 90 days)</h3>
        <div className="mt-4 h-64">
          {earnings_series.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No earnings yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earnings_series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any) => [fmt(Number(v)), "Earnings"]}
                />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Conversion funnel</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Clicks</p>
            <p className="text-2xl font-bold tabular-nums">{funnel.clicks}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Signups</p>
            <p className="text-2xl font-bold tabular-nums">{funnel.signups}</p>
            <p className="text-[11px] text-muted-foreground">{funnel.click_to_signup}% conv.</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Paid customers</p>
            <p className="text-2xl font-bold tabular-nums">{funnel.paid}</p>
            <p className="text-[11px] text-muted-foreground">{funnel.signup_to_paid}% conv.</p>
          </div>
        </div>
      </Card>
    </>
  );
}
