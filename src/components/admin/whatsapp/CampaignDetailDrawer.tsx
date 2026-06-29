import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCheck, Eye, AlertTriangle, IndianRupee, MousePointerClick } from "lucide-react";

type Stats = {
  queued: number; sent: number; delivered: number; read: number; failed: number; clicked: number; cost: number;
};

export function CampaignDetailDrawer({ campaignId, open, onOpenChange }: { campaignId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [camp, setCamp] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({ queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, clicked: 0, cost: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: c } = await supabase.from("platform_wa_campaigns" as any).select("*").eq("id", campaignId).maybeSingle();
        if (cancelled) return;
        setCamp(c);

        const { data: q } = await supabase.from("wa_send_queue" as any).select("status").eq("campaign_id", campaignId);
        const queueRows = (q as any[]) || [];
        const queued = queueRows.filter((r) => r.status === "pending" || r.status === "processing").length;
        const sent = queueRows.filter((r) => r.status === "sent" || r.status === "delivered" || r.status === "read").length;
        const delivered = queueRows.filter((r) => r.status === "delivered" || r.status === "read").length;
        const read = queueRows.filter((r) => r.status === "read").length;
        const failed = queueRows.filter((r) => r.status === "failed").length;

        const { count: clicked } = await supabase.from("wa_link_clicks" as any).select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
        const { data: costs } = await supabase.from("wa_conversation_costs" as any).select("cost_inr").eq("campaign_id", campaignId);
        const cost = ((costs as any[]) || []).reduce((s, r) => s + Number(r.cost_inr || 0), 0);

        if (!cancelled) setStats({ queued, sent, delivered, read, failed, clicked: clicked || 0, cost });
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    const t = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [open, campaignId]);

  const Stat = ({ icon: Icon, label, value, color }: any) => (
    <Card><CardContent className="p-3">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Icon className={`h-3.5 w-3.5 ${color}`}/>{label}</div>
      <div className="text-xl font-semibold mt-1">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</div>
    </CardContent></Card>
  );

  const deliveryRate = stats.sent ? Math.round((stats.delivered / stats.sent) * 100) : 0;
  const readRate = stats.delivered ? Math.round((stats.read / stats.delivered) * 100) : 0;
  const ctr = stats.delivered ? ((stats.clicked / stats.delivered) * 100).toFixed(1) : "0.0";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {camp?.name || "Campaign"}
            {camp?.status && <Badge variant="secondary">{camp.status}</Badge>}
          </SheetTitle>
        </SheetHeader>

        {loading && !camp ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto"/></div> : (
          <div className="space-y-4 mt-4">
            <div className="text-xs text-muted-foreground">
              Template <b>{camp?.template_name}</b> · audience {camp?.audience_size || 0} · queued {camp?.queued_count || 0}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat icon={Send} label="Sent" value={stats.sent} color="text-blue-600"/>
              <Stat icon={CheckCheck} label="Delivered" value={stats.delivered} color="text-green-600"/>
              <Stat icon={Eye} label="Read" value={stats.read} color="text-violet-600"/>
              <Stat icon={MousePointerClick} label="Clicked" value={stats.clicked} color="text-orange-600"/>
              <Stat icon={AlertTriangle} label="Failed" value={stats.failed} color="text-red-600"/>
              <Stat icon={IndianRupee} label="Spent" value={`₹${stats.cost.toFixed(2)}`} color="text-emerald-600"/>
            </div>

            <Card><CardContent className="p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery rate</span><b>{deliveryRate}%</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Read rate</span><b>{readRate}%</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Click-through</span><b>{ctr}%</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pending in queue</span><b>{stats.queued}</b></div>
            </CardContent></Card>

            {camp?.failed_reason && (
              <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                <b>Last error:</b> {camp.failed_reason}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground text-center">Refreshes every 8s while open.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
