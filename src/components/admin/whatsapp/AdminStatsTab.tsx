import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare, Send, XCircle, Users, TrendingUp, CheckCircle2,
} from "lucide-react";

export function AdminStatsTab() {
  const { data: stats } = useQuery({
    queryKey: ["admin-whatsapp-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("status, message_type, created_at, store_id");
      if (error) throw error;
      const total = data?.length || 0;
      const sent = data?.filter((m: any) => m.status === "sent").length || 0;
      const delivered = data?.filter((m: any) => m.status === "delivered").length || 0;
      const failed = data?.filter((m: any) => m.status === "failed").length || 0;
      const today = new Date().toISOString().split("T")[0];
      const todayCount = data?.filter((m: any) => m.created_at.startsWith(today)).length || 0;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekCount = data?.filter((m: any) => m.created_at >= weekAgo).length || 0;
      const byStore: Record<string, number> = {};
      data?.forEach((m: any) => { byStore[m.store_id] = (byStore[m.store_id] || 0) + 1; });
      return { total, sent, delivered, failed, todayCount, weekCount, storeCount: Object.keys(byStore).length };
    },
  });

  const statCards = [
    { label: "Total Messages", value: stats?.total || 0, icon: MessageSquare, color: "text-primary" },
    { label: "Sent Today", value: stats?.todayCount || 0, icon: Send, color: "text-green-600" },
    { label: "This Week", value: stats?.weekCount || 0, icon: TrendingUp, color: "text-blue-600" },
    { label: "Failed", value: stats?.failed || 0, icon: XCircle, color: "text-red-500" },
    { label: "Delivered", value: stats?.delivered || 0, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Active Stores", value: stats?.storeCount || 0, icon: Users, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <span className="text-2xl font-bold">{s.value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
