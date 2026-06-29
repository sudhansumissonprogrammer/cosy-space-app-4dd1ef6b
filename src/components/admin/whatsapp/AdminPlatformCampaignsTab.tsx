import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AudienceSegmentPicker, type AudienceFilter } from "./AudienceSegmentPicker";

export function AdminPlatformCampaignsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  const [audience, setAudience] = useState<AudienceFilter>({ segment: "all", store_id: null });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("platform_wa_campaigns" as any).select("*").order("created_at", { ascending: false }).limit(50);
    if (error) toast.error(error.message); else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name || !template) return toast.error("Name and template required");
    const { error } = await supabase.from("platform_wa_campaigns" as any).insert({
      name, template_name: template, audience_filter: audience as any, status: "draft",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Created");
    setName(""); setTemplate(""); load();
  };

  const run = async (id: string) => {
    const { error } = await supabase.functions.invoke("wa-campaign-runner", { body: { campaign_id: id } });
    if (error) toast.error(error.message); else { toast.success("Campaign queued"); load(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New campaign</CardTitle>
          <CardDescription>Admin-only marketing send via the platform number. Audience is expanded to the queue at run time.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Template name</Label><Input value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="festival_sale_v1" /></div>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Audience</Label>
            <AudienceSegmentPicker value={audience} onChange={setAudience} />
          </div>
          <div className="sm:col-span-2"><Button onClick={create}>Create draft</Button></div>
        </CardContent>
      </Card>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <Card>
          <CardContent className="p-0 divide-y">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.template_name} · audience {r.audience_size || 0} · queued {r.queued_count || 0} · sent {r.sent_count} · failed {r.failed_count}
                  </p>
                </div>
                <Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => run(r.id)} disabled={r.status === "running"}>Run</Button>
              </div>
            ))}
            {!rows.length && <div className="p-6 text-sm text-muted-foreground">No campaigns.</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
