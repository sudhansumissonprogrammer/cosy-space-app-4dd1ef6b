import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Eye, Play, ShieldCheck } from "lucide-react";
import { CampaignWizard } from "./CampaignWizard";
import { CampaignDetailDrawer } from "./CampaignDetailDrawer";

export function AdminPlatformCampaignsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("platform_wa_campaigns" as any).select("*").order("created_at", { ascending: false }).limit(100);
    if (error) toast.error(error.message); else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const precheck = async (id: string) => {
    const { data, error } = await supabase.rpc("wa_campaign_precheck" as any, { _campaign_id: id });
    if (error) return toast.error(error.message);
    const d: any = data || {};
    const msg = `Audience ${d.audience} · remaining today ${d.remaining_today}/${d.tier_limit} · errors: ${(d.errors || []).join(",") || "none"} · warnings: ${(d.warnings || []).join(",") || "none"}`;
    if (!d.can_send) toast.error(msg); else toast.success(msg);
  };

  const run = async (id: string, force = false) => {
    if (!force && !confirm("Run this campaign now? This will enqueue messages for delivery.")) return;
    const { data, error } = await supabase.functions.invoke("wa-campaign-runner", { body: { campaign_id: id, force } });
    if (error) {
      const ctx: any = (error as any).context;
      if (ctx?.precheck && !force && confirm("Pre-check blocked this send. Force run anyway?")) return run(id, true);
      return toast.error(error.message);
    }
    toast.success(`Campaign queued${(data as any)?.enqueued ? `: ${(data as any).enqueued}` : ""}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Marketing campaigns</h3>
          <p className="text-xs text-muted-foreground">Send only on APPROVED + MARKETING templates. Opt-outs, 24h cooldown, and tier limits are enforced automatically.</p>
        </div>
        <Button size="sm" onClick={() => setWizardOpen(true)}><Plus className="h-3.5 w-3.5 mr-1"/>New campaign</Button>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <Card>
          <CardContent className="p-0 divide-y">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.template_name} · audience {r.audience_size || 0} · queued {r.queued_count || 0} · sent {r.sent_count || 0} · failed {r.failed_count || 0}
                    {r.scheduled_at ? ` · scheduled ${new Date(r.scheduled_at).toLocaleString()}` : ""}
                  </p>
                </div>
                <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => precheck(r.id)} title="Pre-check"><ShieldCheck className="h-3.5 w-3.5"/></Button>
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => run(r.id)} disabled={r.status === "running"} title="Run"><Play className="h-3.5 w-3.5"/></Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOpenId(r.id)} title="View stats"><Eye className="h-3.5 w-3.5"/></Button>
              </div>
            ))}
            {!rows.length && <div className="p-6 text-sm text-muted-foreground">No campaigns yet. Click <b>New campaign</b> to build your first one.</div>}
          </CardContent>
        </Card>
      )}

      <CampaignWizard open={wizardOpen} onOpenChange={setWizardOpen} onCreated={load}/>
      <CampaignDetailDrawer open={!!openId} campaignId={openId} onOpenChange={(v) => { if (!v) setOpenId(null); }}/>
    </div>
  );
}
