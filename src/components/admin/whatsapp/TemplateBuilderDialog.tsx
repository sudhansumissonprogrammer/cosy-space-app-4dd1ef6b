import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { extractVars, validateDraft, type TplDraft, type TplButton } from "@/lib/wa-template-validate";
import { TemplatePreview } from "./TemplatePreview";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: Partial<TplDraft> & { name?: string };
  isEdit: boolean;
  onSaved: () => void;
};

const EMPTY: TplDraft = {
  name: "",
  language: "en",
  category: "UTILITY",
  header_type: "TEXT",
  header_text: "",
  body_text: "",
  footer_text: "Powered by shopbanao.in",
  buttons: [],
};

export function TemplateBuilderDialog({ open, onClose, initial, isEdit, onSaved }: Props) {
  const [draft, setDraft] = useState<TplDraft>({ ...EMPTY, ...initial } as TplDraft);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => { if (open) setDraft({ ...EMPTY, ...initial } as TplDraft); }, [open, initial]);

  const issues = useMemo(() => validateDraft(draft), [draft]);
  const errors = issues.filter(i => i.level === "error");
  const warnings = issues.filter(i => i.level === "warn");

  const allVars = useMemo(() => {
    const set = new Set<number>();
    extractVars(draft.body_text || "").forEach(n => set.add(n));
    extractVars(draft.header_text || "").forEach(n => set.add(n));
    (draft.buttons || []).forEach(b => { if (b.type === "URL") extractVars(b.url).forEach(n => set.add(n)); });
    return Array.from(set).sort((a, b) => a - b);
  }, [draft]);

  const [samples, setSamples] = useState<string[]>([]);
  useEffect(() => {
    setSamples(prev => allVars.map((_, i) => prev[i] ?? ["John", "Storivo", "ORD-1234", "₹1,299", "3 items", "Paid", "Mon, 6 Sep"][i] ?? `Sample${i+1}`));
  }, [allVars.length]);

  const persistRow = async () => {
    const payload: any = {
      name: draft.name,
      language: draft.language,
      category: draft.category,
      header_type: draft.header_type,
      header_text: draft.header_text || null,
      body_text: draft.body_text,
      footer_text: draft.footer_text || null,
      buttons: draft.buttons || [],
      purpose: draft.category?.toLowerCase() || "utility",
      variables: allVars.map(n => `var_${n}`),
      headline: draft.header_text || null,
      footer: draft.footer_text || null,
      is_active: true,
    };
    if (!isEdit) payload.meta_status = "draft";
    const { error } = await supabase.from("platform_wa_templates" as any).upsert(payload, { onConflict: "name" } as any);
    if (error) throw error;
  };

  const saveDraft = async () => {
    if (errors.length) { toast.error("Fix validation errors first"); return; }
    setSavingDraft(true);
    try { await persistRow(); toast.success("Draft saved"); onSaved(); onClose(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSavingDraft(false); }
  };

  const submitToMeta = async () => {
    if (errors.length) { toast.error("Fix validation errors first"); return; }
    setSubmitting(true);
    try {
      await persistRow();
      const { data, error } = await supabase.functions.invoke("wa-template-submit", {
        body: { action: isEdit ? "edit" : "create", template_name: draft.name, ...draft },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Submitted to Meta · status: ${(data as any)?.meta_status || "PENDING"}`);
      onSaved();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const insertVar = () => {
    const next = (extractVars(draft.body_text).at(-1) || 0) + 1;
    setDraft(d => ({ ...d, body_text: (d.body_text || "") + `{{${next}}}` }));
  };

  const addButton = (type: TplButton["type"]) => {
    const blank: TplButton = type === "URL" ? { type: "URL", text: "View Order", url: "https://shopbanao.in/" }
      : type === "PHONE_NUMBER" ? { type: "PHONE_NUMBER", text: "Call us", phone_number: "+911234567890" }
      : { type: "QUICK_REPLY", text: "Reply" };
    setDraft(d => ({ ...d, buttons: [...(d.buttons || []), blank].slice(0, 2) }));
  };

  const updateBtn = (i: number, patch: Partial<TplButton>) => {
    setDraft(d => ({ ...d, buttons: (d.buttons || []).map((b, idx) => idx === i ? { ...b, ...patch } as TplButton : b) }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit · ${initial.name}` : "Create new template"}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* LEFT — form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={draft.name} disabled={isEdit}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="e.g. order_confirmation_v3" />
              </div>
              <div>
                <Label>Language</Label>
                <Select value={draft.language} onValueChange={(v) => setDraft({ ...draft, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English (en)</SelectItem>
                    <SelectItem value="en_US">English US (en_US)</SelectItem>
                    <SelectItem value="hi">Hindi (hi)</SelectItem>
                    <SelectItem value="bn">Bengali (bn)</SelectItem>
                    <SelectItem value="ta">Tamil (ta)</SelectItem>
                    <SelectItem value="te">Telugu (te)</SelectItem>
                    <SelectItem value="mr">Marathi (mr)</SelectItem>
                    <SelectItem value="gu">Gujarati (gu)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Category</Label>
              <Select value={draft.category} onValueChange={(v: any) => setDraft({ ...draft, category: v })} disabled={isEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utility — order/shipping updates (cheapest)</SelectItem>
                  <SelectItem value="MARKETING">Marketing — promos, cart recovery</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication — OTP / login</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-[120px,1fr] gap-3 items-end">
              <div>
                <Label>Header</Label>
                <Select value={draft.header_type} onValueChange={(v: any) => setDraft({ ...draft, header_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.header_type === "TEXT" && (
                <Input value={draft.header_text || ""} maxLength={60}
                  onChange={(e) => setDraft({ ...draft, header_text: e.target.value })}
                  placeholder="✅ Order Confirmed" />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Body</Label>
                <Button size="sm" variant="ghost" onClick={insertVar} className="h-7 text-xs">+ Insert variable</Button>
              </div>
              <Textarea rows={8} value={draft.body_text}
                onChange={(e) => setDraft({ ...draft, body_text: e.target.value })}
                placeholder={`Hi {{1}}, your order *{{2}}* is confirmed.\n\nTotal: {{3}}\nExpected by: {{4}}\n\nThanks for shopping with us!`} />
              <div className="text-[11px] text-muted-foreground mt-1">{draft.body_text.length}/1024 · variables: {extractVars(draft.body_text).map(n => `{{${n}}}`).join(" ") || "—"}</div>
            </div>

            <div>
              <Label>Footer (optional)</Label>
              <Input value={draft.footer_text || ""} maxLength={60}
                onChange={(e) => setDraft({ ...draft, footer_text: e.target.value })} />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Buttons (max 2)</Label>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addButton("URL")} disabled={(draft.buttons || []).length >= 2}><Plus className="h-3 w-3 mr-1"/>URL</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addButton("QUICK_REPLY")} disabled={(draft.buttons || []).length >= 2}><Plus className="h-3 w-3 mr-1"/>Quick reply</Button>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {(draft.buttons || []).map((b, i) => (
                  <div key={i} className="border rounded-md p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{b.type}</Badge>
                      <Input className="h-8 text-sm" value={b.text} maxLength={25}
                        onChange={(e) => updateBtn(i, { text: e.target.value } as any)} placeholder="Button text" />
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setDraft(d => ({ ...d, buttons: (d.buttons || []).filter((_, x) => x !== i) }))}>
                        <Trash2 className="h-3 w-3 text-muted-foreground"/>
                      </Button>
                    </div>
                    {b.type === "URL" && (
                      <Input className="h-8 text-sm" value={(b as any).url}
                        onChange={(e) => updateBtn(i, { url: e.target.value } as any)}
                        placeholder="https://shopbanao.in/track/{{1}}" />
                    )}
                  </div>
                ))}
                {!(draft.buttons || []).length && <div className="text-[11px] text-muted-foreground">No buttons</div>}
              </div>
            </div>

            {allVars.length > 0 && (
              <div>
                <Label>Sample values (preview only — Meta requires examples)</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {allVars.map((n, i) => (
                    <Input key={n} className="h-8 text-sm" value={samples[i] || ""}
                      placeholder={`{{${n}}}`}
                      onChange={(e) => { const s = [...samples]; s[i] = e.target.value; setSamples(s); }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — preview + validation */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">WhatsApp preview</Label>
              <TemplatePreview draft={draft} samples={samples} />
            </div>

            {(errors.length > 0 || warnings.length > 0) && (
              <div className="space-y-1">
                {errors.map((e, i) => (
                  <div key={`e${i}`} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0"/>
                    <div><span className="font-medium">{e.field}:</span> {e.message}</div>
                  </div>
                ))}
                {warnings.map((w, i) => (
                  <div key={`w${i}`} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0"/>
                    <div><span className="font-medium">{w.field}:</span> {w.message}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="outline" onClick={saveDraft} disabled={savingDraft || !!errors.length}>
                {savingDraft && <Loader2 className="h-3 w-3 mr-1 animate-spin"/>}Save draft
              </Button>
              <Button onClick={submitToMeta} disabled={submitting || !!errors.length}>
                {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin"/>}Save & Submit to Meta
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
