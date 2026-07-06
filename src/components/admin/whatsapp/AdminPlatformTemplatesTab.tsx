import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, RefreshCw, Pencil, Trash2, Send, Plus, PauseCircle, Loader2, AlertTriangle } from "lucide-react";
import { TemplateBuilderDialog } from "./TemplateBuilderDialog";
import type { TplDraft, TplButton } from "@/lib/wa-template-validate";

type Row = {
  name: string;
  language: string;
  category: string | null;
  header_type: string | null;
  header_text: string | null;
  header_media_url: string | null;
  body_text: string | null;
  footer_text: string | null;
  buttons: TplButton[] | null;
  variables: string[];
  is_active: boolean;
  paused: boolean | null;
  pause_reason: string | null;
  meta_status: string | null;
  meta_template_id: string | null;
  meta_rejected_reason: string | null;
  submitted_at: string | null;
  last_synced_at: string | null;
};

function StatusBadge({ status, paused }: { status: string | null; paused?: boolean | null }) {
  if (paused) return <Badge className="bg-zinc-200 text-zinc-700 text-[10px]"><PauseCircle className="h-3 w-3 mr-1"/>Paused</Badge>;
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1"/>Approved</Badge>;
  if (s === "PENDING")  return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]"><Clock className="h-3 w-3 mr-1"/>Pending</Badge>;
  if (s === "REJECTED") return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]"><XCircle className="h-3 w-3 mr-1"/>Rejected</Badge>;
  if (s === "DELETED")  return <Badge variant="secondary" className="text-[10px]">Deleted</Badge>;
  return <Badge variant="outline" className="text-[10px]">{s || "Draft"}</Badge>;
}

export function AdminPlatformTemplatesTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ open: boolean; draft: Partial<TplDraft> & { name?: string }; isEdit: boolean }>({ open: false, draft: {}, isEdit: false });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("platform_wa_templates" as any).select("*").order("name");
    if (error) toast.error(error.message);
    else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const invoke = async (action: string, name: string) => {
    setBusy(name + ":" + action);
    try {
      const { data, error } = await supabase.functions.invoke("wa-template-submit", { body: { action, template_name: name } });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.error) msg = j.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${action} ok${(data as any)?.meta_status ? ` · ${(data as any).meta_status}` : ""}`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const onSubmit = async (r: Row) => {
    if (!r.body_text) { toast.error("Add a body before submitting"); return; }
    setBusy(r.name + ":submit");
    try {
      const action = r.meta_template_id ? "edit" : "create";
      const { data, error } = await supabase.functions.invoke("wa-template-submit", {
        body: {
          action, template_name: r.name,
          name: r.name, language: r.language, category: (r.category || "UTILITY").toUpperCase(),
          header_type: r.header_type || "TEXT", header_text: r.header_text,
          header_media_url: r.header_media_url,
          body_text: r.body_text, footer_text: r.footer_text, buttons: r.buttons || [],
        },
      });
      if (error) {
        // FunctionsHttpError hides the response body — read it explicitly.
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.error) msg = j.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Submitted · ${(data as any)?.meta_status || "PENDING"}`);
      setTimeout(() => invoke("refresh", r.name), 5000);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const togglePaused = async (r: Row, paused: boolean) => {
    const { error } = await supabase.from("platform_wa_templates" as any).update({ paused, pause_reason: paused ? "manually paused" : null } as any).eq("name", r.name);
    if (error) toast.error(error.message); else load();
  };

  const syncAll = async () => {
    setBusy("__syncAll");
    try {
      const { data, error } = await supabase.functions.invoke("wa-template-sync", { body: {} });
      if (error) {
        // FunctionsHttpError hides the JSON body; fetch it out for a useful message.
        let hint = "";
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            hint = j?.hint || j?.details?.error?.message || j?.error || "";
          }
        } catch {}
        throw new Error(hint || error.message);
      }
      const d: any = data || {};
      if (d.skipped) toast.info(`Sync skipped: ${d.reason}`);
      else toast.success(`Synced ${d.updated ?? 0} of ${d.total ?? 0} templates from Meta`);
      await load();
    } catch (e: any) { toast.error(e.message, { duration: 10000 }); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          Templates submitted via this panel post directly to Meta. Approval typically arrives in 1–60 min.
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={syncAll} disabled={busy === "__syncAll"}>
            {busy === "__syncAll" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin"/> : <RefreshCw className="h-3.5 w-3.5 mr-1"/>}
            Sync all from Meta
          </Button>
          <Button size="sm" onClick={() => setEditing({ open: true, draft: { name: "" }, isEdit: false })}>
            <Plus className="h-3.5 w-3.5 mr-1"/>New template
          </Button>
        </div>
      </div>


      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {rows.map((r) => (
              <div key={r.name} className="p-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <StatusBadge status={r.meta_status} paused={r.paused}/>
                      <Badge variant="outline" className="text-[10px]">{(r.category || "UTILITY").toUpperCase()}</Badge>
                      <Badge variant="outline" className="text-[10px]">{r.language}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {r.submitted_at ? `Submitted ${new Date(r.submitted_at).toLocaleString()}` : "Not submitted"}
                      {r.last_synced_at ? ` · synced ${new Date(r.last_synced_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={!r.paused && r.is_active} onCheckedChange={(v) => togglePaused(r, !v)} title="Active for sending"/>
                    <Button size="sm" variant="ghost" className="h-7 px-2" disabled={!!busy} onClick={() => invoke("refresh", r.name)}>
                      {busy === r.name + ":refresh" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <RefreshCw className="h-3.5 w-3.5"/>}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditing({ open: true, draft: {
                      name: r.name, language: r.language, category: (r.category as any) || "UTILITY",
                      header_type: (r.header_type as any) || "TEXT", header_text: r.header_text || "",
                      header_media_url: (r as any).header_media_url || "",
                      body_text: r.body_text || "", footer_text: r.footer_text || "", buttons: r.buttons || [],
                      variables: (r as any).variables || [],
                    } as any, isEdit: true })}>
                      <Pencil className="h-3.5 w-3.5"/>
                    </Button>
                    <Button size="sm" className="h-7 px-2" disabled={!!busy || !r.body_text} onClick={() => onSubmit(r)}>
                      {busy === r.name + ":submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Send className="h-3.5 w-3.5"/>}
                      <span className="ml-1 text-xs">{r.meta_template_id ? "Resubmit" : "Submit"}</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" disabled={!!busy}
                      onClick={() => { if (confirm(`Delete ${r.name} from Meta + DB?`)) invoke("delete", r.name); }}>
                      <Trash2 className="h-3.5 w-3.5"/>
                    </Button>
                  </div>
                </div>
                {r.meta_rejected_reason && (
                  <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0"/>
                    <span><b>Rejected:</b> {r.meta_rejected_reason}</span>
                  </div>
                )}
                {r.body_text && (
                  <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-3 pl-1 border-l-2 border-muted">
                    {r.body_text}
                  </p>
                )}
              </div>
            ))}
            {!rows.length && <div className="p-6 text-sm text-muted-foreground">No templates yet. Click <b>+ New template</b>.</div>}
          </CardContent>
        </Card>
      )}

      <TemplateBuilderDialog
        open={editing.open}
        isEdit={editing.isEdit}
        initial={editing.draft}
        onClose={() => setEditing({ open: false, draft: {}, isEdit: false })}
        onSaved={load}
      />
    </div>
  );
}
