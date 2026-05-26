import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { ChartSkeleton } from "@/components/admin/AdminSkeletons";

export default function AdminAnalytics() {
  useDocumentTitle("Analytics · Admin");
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_analytics");
      if (error) throw error;
      return data as {
        stores_by_month: { month: string; count: number }[];
        revenue_by_month: { month: string; revenue: number; orders: number }[];
        users_by_month: { month: string; count: number }[];
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
          <div className="lg:col-span-2"><ChartSkeleton /></div>
        </div>
      </div>
    );
  }

  const storesData = (analytics?.stores_by_month || []).reverse();
  const revenueData = (analytics?.revenue_by_month || []).reverse();
  const usersData = (analytics?.users_by_month || []).reverse();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">No revenue data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Store Growth</CardTitle>
          </CardHeader>
          <CardContent>
            {storesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={storesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">No store data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">User Signups by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {usersData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={usersData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">No user data yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
