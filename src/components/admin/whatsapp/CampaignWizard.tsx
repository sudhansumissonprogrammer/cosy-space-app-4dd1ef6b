import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { CalendarIcon, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, ArrowRight, Send, IndianRupee, Users, Clock } from "lucide-react";
import { format } from "date-fns";
import { AudienceSegmentPicker, type AudienceFilter } from "./AudienceSegmentPicker";
import { TemplatePreview } from "./TemplatePreview";
import type { TplDraft, TplButton } from "@/lib/wa-template-validate";
import { cn } from "@/lib/utils";

type Tpl = {
  name: string; language: string; category: string;
  header_type: string | null; header_text: string | null;
  body_text: string | null; footer_text: string | null;
  buttons: TplButton[] | null;
  variables: string[] | null;
};


function extractVars(s: string | null | undefined): number[] {
  const set = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while (s && (m = re.exec(s))) set.add(Number(m[1]));
  return Array.from(set).sort((a, b) => a - b);
}

function istHour(d: Date) {
  // IST = UTC+5:30
  const ist = new Date(d.getTime() + (5.5 * 60 - d.getTimezoneOffset()) * 60_000);
  return ist.getHours();
}

export function CampaignWizard({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({}); // index → value
  const [audience, setAudience] = useState<AudienceFilter>({ segment: "all", store_id: null });
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [costPerMsg, setCostPerMsg] = useState<number>(0.78); // INR marketing default
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1); setName(""); setTemplateName(""); setVars({});
    setAudience({ segment: "all", store_id: null }); setAudienceCount(null);
    setScheduleNow(true); setScheduleDate(undefined); setScheduleTime("10:00");
    supabase.from("platform_wa_templates" as any).select("name,language,category,header_type,header_text,body_text,footer_text,buttons,meta_status,paused,is_active")
      .eq("meta_status", "APPROVED").eq("is_active", true)
      .then(({ data }) => {
        const all = ((data as any[]) || []).filter((t) => !t.paused && (t.category || "").toUpperCase() === "MARKETING");
        setTemplates(all as Tpl[]);
      });
  }, [open]);

  const tpl = useMemo(() => templates.find((t) => t.name === templateName) || null, [templates, templateName]);
  const varIndexes = useMemo(() => {
    if (!tpl) return [] as number[];
    const set = new Set<number>([...extractVars(tpl.header_text), ...extractVars(tpl.body_text)]);
    return Array.from(set).sort((a, b) => a - b);
  }, [tpl]);

  // Audience estimate live
  const estimateAudience = async () => {
    setAudienceLoading(true);
    try {
      const { data, error } = await supabase.rpc("expand_campaign_audience" as any, { _filter: audience });
      if (error) throw error;
      setAudienceCount(((data as any) || []).length);
    } catch (e: any) { toast.error(e.message); }
    finally { setAudienceLoading(false); }
  };
  useEffect(() => { if (step === 3) estimateAudience(); /* eslint-disable-next-line */ }, [step, audience.segment, audience.store_id]);

  const scheduledAtISO = useMemo(() => {
    if (scheduleNow) return new Date().toISOString();
    if (!scheduleDate) return null;
    const [h, m] = scheduleTime.split(":").map(Number);
    const d = new Date(scheduleDate);
    d.setHours(h || 10, m || 0, 0, 0);
    return d.toISOString();
  }, [scheduleNow, scheduleDate, scheduleTime]);

  const scheduledOutsideWindow = useMemo(() => {
    if (!scheduledAtISO) return false;
    const h = istHour(new Date(scheduledAtISO));
    return h < 9 || h >= 21;
  }, [scheduledAtISO]);

  const estCost = (audienceCount ?? 0) * costPerMsg;

  const previewDraft: TplDraft | null = tpl ? {
    name: tpl.name, language: tpl.language,
    category: (tpl.category || "MARKETING").toUpperCase() as any,
    header_type: (tpl.header_type as any) || "NONE",
    header_text: tpl.header_text || "",
    body_text: tpl.body_text || "",
    footer_text: tpl.footer_text || "",
    buttons: tpl.buttons || [],
  } : null;
  const sampleArr = varIndexes.map((i) => vars[String(i)] || `Sample${i}`);

  const canNext1 = name.trim().length >= 2 && templateName;
  const canNext2 = varIndexes.every((i) => (vars[String(i)] || "").trim().length > 0);
  const canCreate = step === 4 && (audienceCount ?? 0) > 0 && !!scheduledAtISO && !submitting;

  const create = async () => {
    if (!tpl) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("platform_wa_campaigns" as any).insert({
        name: name.trim(),
        template_name: tpl.name,
        audience_filter: audience as any,
        template_vars: vars as any,
        status: scheduleNow ? "draft" : "scheduled",
        scheduled_at: scheduledAtISO,
      } as any).select("id").maybeSingle();
      if (error) throw error;
      toast.success(scheduleNow ? "Campaign created. Open it in the list and click Run." : "Campaign scheduled");
      onCreated(); onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-green-600"/> New campaign
            <Badge variant="secondary" className="ml-2">Step {step} of 4</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {["Template", "Variables", "Audience", "Review"].map((s, i) => (
            <div key={s} className={cn("flex-1 h-1.5 rounded", step > i ? "bg-green-500" : step === i + 1 ? "bg-green-300" : "bg-zinc-200")}/>
          ))}
        </div>

        {/* Step 1 — name + template */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali Sale Oct 26"/>
            </div>
            <div>
              <Label>Template (only APPROVED + MARKETING shown)</Label>
              <Select value={templateName} onValueChange={setTemplateName}>
                <SelectTrigger><SelectValue placeholder="Pick a template"/></SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No approved marketing templates. Submit one in the Templates tab.</div>}
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>{t.name} · {t.language}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tpl && (
              <Card><CardContent className="p-3">
                <TemplatePreview draft={previewDraft!} samples={varIndexes.map((i) => `{{${i}}}`)}/>
              </CardContent></Card>
            )}
          </div>
        )}

        {/* Step 2 — variables */}
        {step === 2 && tpl && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">Provide a value (or token like <code>{`{{customer_name}}`}</code>) for each variable in the template. These resolve per recipient at send time.</div>
            {varIndexes.length === 0 && <div className="text-sm text-muted-foreground">This template has no variables.</div>}
            <div className="grid sm:grid-cols-2 gap-3">
              {varIndexes.map((i) => (
                <div key={i}>
                  <Label>Variable {`{{${i}}}`}</Label>
                  <Input value={vars[String(i)] || ""} onChange={(e) => setVars({ ...vars, [String(i)]: e.target.value })} placeholder={`Value for {{${i}}}`}/>
                </div>
              ))}
            </div>
            <Card><CardContent className="p-3">
              <div className="text-xs text-muted-foreground mb-2">Live preview</div>
              <TemplatePreview draft={previewDraft!} samples={sampleArr}/>
            </CardContent></Card>
          </div>
        )}

        {/* Step 3 — audience */}
        {step === 3 && (
          <div className="space-y-4">
            <AudienceSegmentPicker value={audience} onChange={(v) => { setAudience(v); setAudienceCount(null); }}/>
            <Card><CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground"/>
                {audienceLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> :
                  <span><b>{(audienceCount ?? 0).toLocaleString("en-IN")}</b> recipients (after opt-out + 24h cooldown filter at send time)</span>}
              </div>
              <Button size="sm" variant="outline" onClick={estimateAudience} disabled={audienceLoading}>Refresh</Button>
            </CardContent></Card>
          </div>
        )}

        {/* Step 4 — review + schedule */}
        {step === 4 && tpl && (
          <div className="space-y-4">
            <Card><CardContent className="p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><b>{name}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Template</span><b>{tpl.name} · {tpl.language}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/>Audience</span>
                <b>{(audienceCount ?? 0).toLocaleString("en-IN")}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><IndianRupee className="h-3 w-3"/>Est. cost</span>
                <b>₹{estCost.toFixed(2)} <span className="text-[10px] text-muted-foreground">@ ₹{costPerMsg}/msg</span></b></div>
            </CardContent></Card>

            <div>
              <Label>When to send</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" size="sm" variant={scheduleNow ? "default" : "outline"} onClick={() => setScheduleNow(true)}>Send now</Button>
                <Button type="button" size="sm" variant={!scheduleNow ? "default" : "outline"} onClick={() => setScheduleNow(false)}>Schedule</Button>
              </div>
              {!scheduleNow && (
                <div className="flex items-center gap-2 mt-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[200px] justify-start text-left", !scheduleDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5"/>
                        {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus disabled={(d) => d < new Date(Date.now() - 86400000)} className={cn("p-3 pointer-events-auto")}/>
                    </PopoverContent>
                  </Popover>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-[120px]"/>
                  <span className="text-[11px] text-muted-foreground">IST</span>
                </div>
              )}
              {scheduledOutsideWindow && (
                <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-start gap-1">
                  <Clock className="h-3 w-3 mt-0.5"/>
                  <span>Send is outside 09:00–21:00 IST. Higher block / opt-out risk. Consider rescheduling.</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground flex items-start gap-1">
              <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-600"/>
              Pre-check runs automatically when you click <b className="mx-1">Run</b> from the campaign list. Opt-outs, 24h marketing cooldown, and tier limits are enforced at the queue worker.
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1"/>{step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 4 ? (
            <Button size="sm" disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && (audienceCount ?? 0) === 0)} onClick={() => setStep(step + 1)}>
              Next<ArrowRight className="h-3.5 w-3.5 ml-1"/>
            </Button>
          ) : (
            <Button size="sm" disabled={!canCreate} onClick={create}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1"/> : <Send className="h-3.5 w-3.5 mr-1"/>}
              {scheduleNow ? "Create draft" : "Schedule campaign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
