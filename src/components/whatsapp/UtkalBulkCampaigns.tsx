import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Send, Pause, Play, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parsePhoneList } from "@/lib/utkalBulkPhones";

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("utkal-wa-bulk", { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { msg = (await error.context.json())?.error || msg; } catch { /* keep */ }
    }
    throw new Error(msg);
  }
  return data as any;
}

const REASON_LABELS: Record<string, string> = {
  "131049": "Meta held back (marketing limit per person)",
  "131026": "Not on WhatsApp / can't receive",
  "131047": "Re-engagement window",
  "131050": "Customer stopped marketing messages",
  daily_cap: "Already got 2 marketing messages today",
  weekly_marketing_cap: "Already got 3 marketing messages this week",
  recent_buyer_4d: "Bought in last 4 days (protected)",
  opted_out: "Opted out",
  tier_limit: "Daily sending limit reached",
  campaign_cancelled: "Campaign cancelled",
  campaign_paused_or_cancelled: "Campaign cancelled",
};

export function UtkalBulkCampaigns() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  const [fileName, setFileName] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const templates = useQuery({ queryKey: ["utkal-bulk-templates"], queryFn: () => call({ action: "templates" }) });
  const campaigns = useQuery({ queryKey: ["utkal-bulk-campaigns"], queryFn: () => call({ action: "campaigns" }), refetchInterval: 15000 });
  const stats = useQuery({
    queryKey: ["utkal-bulk-stats", selected],
    queryFn: () => call({ action: "stats", campaign_id: selected }),
    enabled: !!selected,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!template && templates.data?.templates?.length) setTemplate(templates.data.templates[0].name);
  }, [templates.data, template]);
  useEffect(() => {
    if (!selected && campaigns.data?.campaigns?.length) setSelected(campaigns.data.campaigns[0].id);
  }, [campaigns.data, selected]);

  const tpl = useMemo(() => templates.data?.templates?.find((t: any) => t.name === template), [templates.data, template]);

  const onFile = async (f?: File) => {
    if (!f) return;
    const text = await f.text();
    const r = parsePhoneList(text);
    setFileName(f.name); setPhones(r.phones); setRawCount(r.raw);
    toast.success(`${r.phones.length} unique numbers found in ${f.name}`);
  };

  const send = async () => {
    if (!name.trim() || !template || !phones.length) return;
    if (!confirm(`Send "${template}" to ${phones.length} numbers now?`)) return;
    setSending(true);
    try {
      const r = await call({ action: "create", name, template_name: template, phones });
      toast.success(`${r.enqueued} messages queued. Sending has started.`);
      setSelected(r.campaign_id); setPhones([]); setFileName(""); setName("");
      qc.invalidateQueries({ queryKey: ["utkal-bulk-campaigns"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSending(false); }
  };

  const act = async (action: string) => {
    try { await call({ action, campaign_id: selected }); qc.invalidateQueries(); toast.success("Updated"); }
    catch (e) { toast.error((e as Error).message); }
  };

  const s = stats.data?.stats;
  const c = stats.data?.campaign;
  const done = s ? s.total - s.pending : 0;
  const pct = s?.total ? Math.round((done / s.total) * 100) : 0;
  const rate = (n: number) => (s?.accepted ? `${Math.round((n / s.accepted) * 100)}%` : "–");

  return (
    <div className="space-y-5 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New bulk campaign</CardTitle>
          <CardDescription>Upload your customer list, choose an approved template, and send.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali Sale – batch 1" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger><SelectValue placeholder={templates.isLoading ? "Loading…" : "No approved template"} /></SelectTrigger>
                <SelectContent>
                  {(templates.data?.templates || []).map((t: any) => (
                    <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tpl && (
            <div className="rounded-lg border bg-muted/40 p-3 flex gap-3">
              {tpl.header_media_url && <img src={tpl.header_media_url} alt="" className="h-28 w-28 rounded object-cover shrink-0" loading="lazy" />}
              <div className="text-xs whitespace-pre-wrap text-foreground/90 line-clamp-[10]">{tpl.body_text}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Customer list (CSV or TXT)</Label>
            <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-5 cursor-pointer hover:bg-muted/40 text-sm">
              <Upload className="h-4 w-4" />
              {fileName ? `${fileName} — ${phones.length} unique numbers (of ${rawCount} rows)` : "Choose file with phone numbers"}
              <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <p className="text-[11px] text-muted-foreground">Duplicates, fake and invalid numbers, and opted-out customers are removed automatically. Max 10,000 per campaign.</p>
          </div>

          <Button onClick={send} disabled={sending || !name.trim() || !template || !phones.length} className="w-full sm:w-auto">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send to {phones.length || 0} customers
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Campaign results</CardTitle>
            <CardDescription>Updates automatically every 10 seconds.</CardDescription>
          </div>
          <Select value={selected || ""} onValueChange={setSelected}>
            <SelectTrigger className="w-56"><SelectValue placeholder="No campaigns yet" /></SelectTrigger>
            <SelectContent>
              {(campaigns.data?.campaigns || []).map((x: any) => (
                <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        {s && c && (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="capitalize">{c.status}</Badge>
              <span className="text-muted-foreground">{c.template_name}</span>
              <div className="ml-auto flex gap-2">
                {c.status === "queued" && <Button size="sm" variant="outline" onClick={() => act("pause")}><Pause className="h-3.5 w-3.5 mr-1" />Pause</Button>}
                {c.status === "paused" && <Button size="sm" variant="outline" onClick={() => act("resume")}><Play className="h-3.5 w-3.5 mr-1" />Resume</Button>}
                {(c.status === "queued" || c.status === "paused") && <Button size="sm" variant="outline" onClick={() => act("cancel")}><XCircle className="h-3.5 w-3.5 mr-1" />Cancel</Button>}
                <Button size="sm" variant="ghost" onClick={() => stats.refetch()}><RefreshCw className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span>Processed {done} / {s.total}</span><span>{pct}%</span></div>
              <Progress value={pct} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Waiting to send", s.pending, ""],
                ["Sent successfully", s.accepted, ""],
                ["Delivered", s.delivered, rate(s.delivered)],
                ["Read", s.read, rate(s.read)],
                ["Not delivered", s.not_delivered, rate(s.not_delivered)],
                ["Failed to send", s.failed, ""],
                ["Skipped (protected)", s.skipped, ""],
                ["Total in campaign", s.total, ""],
              ].map(([l, v, sub]) => (
                <div key={l as string} className="rounded-lg border p-3">
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                  <div className="text-xl font-semibold">{v as number}</div>
                  {sub && <div className="text-[11px] text-muted-foreground">{sub} of sent</div>}
                </div>
              ))}
            </div>
            {c.upload && (
              <p className="text-xs text-muted-foreground">
                Upload: {c.upload.uploaded} rows · {c.upload.invalid} invalid · {c.upload.duplicates} duplicates · {c.upload.opted_out} opted out removed.
              </p>
            )}
            {s.reasons?.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Why some didn't go through</div>
                <div className="divide-y rounded-lg border text-sm">
                  {s.reasons.map((r: any) => (
                    <div key={r.reason} className="flex justify-between p-2.5">
                      <span>{REASON_LABELS[r.reason] || r.reason}</span>
                      <span className="font-medium">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
