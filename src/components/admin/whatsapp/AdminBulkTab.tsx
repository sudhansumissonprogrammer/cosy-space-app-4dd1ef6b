import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Send, XCircle, Users, Upload, Megaphone, Trash2,
  Plus, MessageSquare, FileCheck,
} from "lucide-react";

export function AdminBulkTab() {
  const queryClient = useQueryClient();
  const [numbers, setNumbers] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [csvFileName, setCsvFileName] = useState("");
  const [sendMode, setSendMode] = useState<"text" | "template">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const { data: approvedTemplates } = useQuery({
    queryKey: ["admin-approved-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("meta_status", "APPROVED")
        .order("template_name");
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((t: any) => {
        if (seen.has(t.template_name)) return false;
        seen.add(t.template_name); return true;
      });
    },
  });

  const { data: campaigns } = useQuery({
    queryKey: ["admin-bulk-campaigns"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_bulk_campaigns")
        .select("*, stores:store_id(name)")
        .eq("admin_campaign", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const addManualNumbers = () => {
    if (!manualInput.trim()) return;
    const newNumbers = manualInput.split(/[\n,;]+/).map((n) => n.replace(/[\s\-()]/g, "").trim())
      .filter((n) => n.length >= 10 && /^\+?\d+$/.test(n));
    const unique = [...new Set([...numbers, ...newNumbers])];
    setNumbers(unique); setManualInput("");
    toast({ title: `Added ${newNumbers.length} numbers`, description: `Total: ${unique.length}` });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string; if (!text) return;
      const extracted: string[] = [];
      for (const line of text.split("\n")) for (const cell of line.split(",")) {
        const cleaned = cell.replace(/[\s\-()\"']/g, "").trim();
        if (cleaned.length >= 10 && /^\+?\d{10,15}$/.test(cleaned)) extracted.push(cleaned);
      }
      const unique = [...new Set([...numbers, ...extracted])];
      setNumbers(unique);
      toast({ title: `Imported ${extracted.length} numbers from CSV`, description: `Total: ${unique.length}` });
    };
    reader.readAsText(file); e.target.value = "";
  };

  const getTemplateParamCount = (bodyText: string): number => {
    const matches = bodyText.match(/\{\{\d+\}\}/g);
    if (!matches) return 0;
    return Math.max(...matches.map((m) => parseInt(m.replace(/[{}]/g, ""))));
  };

  const handleTemplateSelect = (templateName: string) => {
    setSelectedTemplate(templateName);
    const tpl = approvedTemplates?.find((t: any) => t.template_name === templateName);
    if (tpl) setTemplateParams(new Array(getTemplateParamCount((tpl as any).body_text || "")).fill(""));
  };

  const sendBulk = async () => {
    if (numbers.length === 0) return;
    if (sendMode === "template" && !selectedTemplate) return;
    if (sendMode === "text" && !message.trim()) return;
    setSending(true); setProgress({ sent: 0, failed: 0, total: numbers.length });
    const tpl = approvedTemplates?.find((t: any) => t.template_name === selectedTemplate);
    const storeId = tpl?.store_id;
    let campaignId: string | null = null;
    if (storeId) {
      const { data: campaign } = await (supabase as any).from("whatsapp_bulk_campaigns").insert({
        store_id: storeId, admin_campaign: true, recipient_count: numbers.length, status: "sending",
        message_body: sendMode === "text" ? message.trim() : null,
        template_name: sendMode === "template" ? selectedTemplate : null,
        template_params: sendMode === "template" ? templateParams.filter((p) => p.trim()) : null,
      }).select("id").single();
      campaignId = campaign?.id;
    }
    let sent = 0, failed = 0;
    for (const phone of numbers) {
      try {
        const body: any = { store_id: storeId, recipient_phone: phone, message_type: sendMode === "template" ? "bulk_template" : "manual" };
        if (sendMode === "template") { body.template_name = selectedTemplate; body.template_params = templateParams.filter((p) => p.trim()); }
        else body.message_body = message.trim();
        const res = await supabase.functions.invoke("whatsapp-send", { body });
        if (res.error || (res.data as any)?.error) failed++; else sent++;
      } catch { failed++; }
      setProgress({ sent, failed, total: numbers.length });
      await new Promise((r) => setTimeout(r, 500));
    }
    if (campaignId) {
      await (supabase as any).from("whatsapp_bulk_campaigns").update({ sent_count: sent, failed_count: failed, status: "completed", completed_at: new Date().toISOString() }).eq("id", campaignId);
    }
    setSending(false);
    queryClient.invalidateQueries({ queryKey: ["admin-bulk-campaigns"] });
    toast({ title: "Bulk send complete!", description: `✅ ${sent} sent, ❌ ${failed} failed` });
  };

  const progressPercent = progress.total > 0 ? ((progress.sent + progress.failed) / progress.total) * 100 : 0;
  const selectedTpl = approvedTemplates?.find((t: any) => t.template_name === selectedTemplate);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Recipients ({numbers.length})</CardTitle>
          <CardDescription>Add phone numbers manually or import from CSV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea value={manualInput} onChange={(e) => setManualInput(e.target.value)}
              placeholder={"Enter phone numbers (one per line or comma-separated)\n+919876543210\n+918765432109"} rows={3} className="text-sm" />
            <Button variant="outline" size="sm" onClick={addManualNumbers} disabled={!manualInput.trim()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Numbers
            </Button>
          </div>
          <div className="relative flex items-center gap-3">
            <Separator className="flex-1" /><span className="text-xs text-muted-foreground">OR</span><Separator className="flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" />{csvFileName || "Upload CSV"}
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
              </label>
            </Button>
            {csvFileName && <span className="text-xs text-muted-foreground">{csvFileName}</span>}
          </div>
          {numbers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{numbers.length} Recipients</Label>
                <Button variant="ghost" size="sm" onClick={() => { setNumbers([]); setCsvFileName(""); }} className="text-xs text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-3 w-3" /> Clear
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {numbers.slice(0, 50).map((num, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-sm">
                    <span className="font-mono text-xs">{num}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setNumbers(numbers.filter((_, idx) => idx !== i))}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {numbers.length > 50 && <p className="text-xs text-muted-foreground">...and {numbers.length - 50} more</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Megaphone className="h-5 w-5" /> Compose Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant={sendMode === "template" ? "default" : "outline"} size="sm" className="text-xs flex-1" onClick={() => setSendMode("template")}>
              <FileCheck className="h-3 w-3 mr-1" /> Meta Template
            </Button>
            <Button variant={sendMode === "text" ? "default" : "outline"} size="sm" className="text-xs flex-1" onClick={() => setSendMode("text")}>
              <MessageSquare className="h-3 w-3 mr-1" /> Plain Text
            </Button>
          </div>
          {sendMode === "template" ? (
            <div className="space-y-3">
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select approved template..." /></SelectTrigger>
                <SelectContent>
                  {approvedTemplates?.map((t: any) => (
                    <SelectItem key={t.id} value={t.template_name}>
                      {t.template_name}<Badge variant="outline" className="text-[9px] ml-2">{t.meta_category}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTpl && (<div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border">{(selectedTpl as any).body_text}</div>)}
              {templateParams.length > 0 && templateParams.map((param, i) => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs">{`{{${i + 1}}}`}</Label>
                  <Input value={param} onChange={(e) => { const u = [...templateParams]; u[i] = e.target.value; setTemplateParams(u); }}
                    placeholder={`Value for {{${i + 1}}}`} className="text-sm" />
                </div>
              ))}
            </div>
          ) : (
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..." rows={4} className="text-sm" />
          )}
          {sending && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>✅ {progress.sent} sent</span><span>❌ {progress.failed} failed</span>
                <span>{progress.sent + progress.failed}/{progress.total}</span>
              </div>
            </div>
          )}
          <Button onClick={sendBulk} disabled={sending || numbers.length === 0 || (sendMode === "template" ? !selectedTemplate : !message.trim())} className="w-full">
            <Send className="mr-2 h-4 w-4" />
            {sending ? `Sending... (${progress.sent + progress.failed}/${progress.total})` : `Send to ${numbers.length} Recipients`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Campaign History</CardTitle></CardHeader>
        <CardContent>
          {!campaigns?.length ? <p className="text-sm text-muted-foreground text-center py-6">No admin campaigns yet</p> : (
            <div className="space-y-3">
              {campaigns.map((c: any) => (
                <div key={c.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.template_name || "Plain text"}</span>
                    <Badge className={cn("text-[10px]",
                      c.status === "completed" ? "bg-green-100 text-green-700 border-green-200" :
                      c.status === "sending" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                      "bg-muted text-muted-foreground")}>{c.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.recipient_count} recipients</span><span>✅ {c.sent_count} · ❌ {c.failed_count}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy, hh:mm a")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
