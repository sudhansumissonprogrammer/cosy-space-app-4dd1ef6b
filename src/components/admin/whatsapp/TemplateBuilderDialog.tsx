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
import { Trash2, Plus, AlertTriangle, Loader2, Info } from "lucide-react";
import { extractVars, validateDraft, type TplDraft, type TplButton } from "@/lib/wa-template-validate";
import { WA_SYSTEM_VARIABLES, getSystemVar } from "@/lib/wa-system-variables";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  header_media_url: "",
  body_text: "",
  footer_text: "Powered by shopbanao.in",
  buttons: [],
};


export function TemplateBuilderDialog({ open, onClose, initial, isEdit, onSaved }: Props) {
  const [draft, setDraft] = useState<TplDraft>({ ...EMPTY, ...initial } as TplDraft);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  // Ordered mapping: position index (1-based) → system variable key.
  // Persisted to platform_wa_templates.variables[] so the sender resolves
  // {{n}} → template_vars[key] per recipient.
  const [varKeys, setVarKeys] = useState<string[]>([]);


  useEffect(() => {
    if (!open) return;
    setDraft({ ...EMPTY, ...initial } as TplDraft);
    setVarKeys(Array.isArray((initial as any)?.variables) ? (initial as any).variables : []);
  }, [open, initial]);

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

  // Keep varKeys aligned with allVars length.
  useEffect(() => {
    setVarKeys(prev => allVars.map((_, i) => prev[i] || ""));
  }, [allVars.length]);

  const samples = useMemo(
    () => allVars.map((_, i) => {
      const k = varKeys[i];
      const sys = k ? getSystemVar(k) : undefined;
      return sys?.example || `Sample${i + 1}`;
    }),
    [allVars, varKeys],
  );

  const persistRow = async () => {
    const payload: any = {
      name: draft.name,
      language: draft.language,
      category: draft.category,
      header_type: draft.header_type,
      header_text: draft.header_type === "TEXT" ? (draft.header_text || null) : null,
      header_media_url: (draft.header_type === "IMAGE" || draft.header_type === "VIDEO" || draft.header_type === "DOCUMENT") ? (draft.header_media_url || null) : null,
      body_text: draft.body_text,
      footer_text: draft.footer_text || null,
      buttons: draft.buttons || [],
      purpose: draft.category?.toLowerCase() || "utility",
      // Real keys (e.g. ["customer_name","store_name","product_name"]) — the
      // sender resolves each {{n}} via template_vars[ variables[n-1] ].
      variables: varKeys.map(k => (k || "").trim()),
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
    if (allVars.length && varKeys.some(k => !k)) { toast.error("Assign a system variable to every {{n}} position"); return; }
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

  const testSend = async () => {
    if (!testPhone.trim()) { toast.error("Enter a test phone number"); return; }
    setTesting(true);
    try {
      // Use sample values from the system-variable defaults so the message renders cleanly.
      const tplVars: Record<string, string> = {};
      varKeys.forEach((k, i) => {
        if (!k) return;
        const sys = getSystemVar(k);
        tplVars[k] = sys?.example || `Sample${i + 1}`;
      });
      if (draft.header_media_url && (draft.header_type === "IMAGE" || draft.header_type === "VIDEO" || draft.header_type === "DOCUMENT")) {
        tplVars.header_media_url = draft.header_media_url;
      }
      const { data, error } = await supabase.functions.invoke("wa-platform-send", {
        body: {
          mode: "test",
          recipient_phone: testPhone.trim(),
          template_name: draft.name,
          template_vars: tplVars,
          language: draft.language,
          message_type: "test",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.skipped) toast.warning(`Skipped: ${(data as any).reason}`);
      else toast.success("Test message sent");
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
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

            <div className="grid grid-cols-[140px,1fr] gap-3 items-end">
              <div>
                <Label>Header</Label>
                <Select value={draft.header_type} onValueChange={(v: any) => setDraft({ ...draft, header_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="DOCUMENT">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.header_type === "TEXT" && (
                <Input value={draft.header_text || ""} maxLength={60}
                  onChange={(e) => setDraft({ ...draft, header_text: e.target.value })}
                  placeholder="✅ Order Confirmed" />
              )}
              {(draft.header_type === "IMAGE" || draft.header_type === "VIDEO" || draft.header_type === "DOCUMENT") && (
                <Input value={draft.header_media_url || ""}
                  onChange={(e) => setDraft({ ...draft, header_media_url: e.target.value })}
                  placeholder={draft.header_type === "IMAGE" ? "https://…/banner.jpg" : draft.header_type === "VIDEO" ? "https://…/clip.mp4" : "https://…/invoice.pdf"} />
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

            {/* Variable mapping — every {{n}} in body / header / button URL
                must be bound to a system variable key so the sender can resolve
                it per recipient (template_vars[key]). */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Variable mapping</Label>
                <span className="text-[11px] text-muted-foreground">{allVars.length} placeholder(s)</span>
              </div>
              {allVars.length === 0 ? (
                <div className="text-[11px] text-muted-foreground mt-1">
                  No variables yet. Click a chip below to insert one into the body.
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {allVars.map((n, i) => {
                    const sys = varKeys[i] ? getSystemVar(varKeys[i]) : undefined;
                    return (
                      <div key={n} className="grid grid-cols-[60px,1fr,auto] gap-2 items-center">
                        <Badge variant="outline" className="font-mono justify-center">{`{{${n}}}`}</Badge>
                        <Select value={varKeys[i] || ""} onValueChange={(v) => {
                          const next = [...varKeys]; next[i] = v; setVarKeys(next);
                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select system variable…"/></SelectTrigger>
                          <SelectContent>
                            {(["branding","order","cart","all"] as const).map((scope) => (
                              <div key={scope}>
                                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">{scope}</div>
                                {WA_SYSTEM_VARIABLES.filter(v => v.scope === scope).map(v => (
                                  <SelectItem key={v.key} value={v.key}>{v.label} · <span className="font-mono text-[10px] text-muted-foreground">{v.key}</span></SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                        {sys && (
                          <TooltipProvider><Tooltip>
                            <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground"/></TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">
                              <div className="font-medium">{sys.label}</div>
                              <div className="text-muted-foreground">{sys.description}</div>
                              <div className="mt-1">e.g. <span className="font-mono">{sys.example}</span></div>
                            </TooltipContent>
                          </Tooltip></TooltipProvider>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3">
                <div className="text-[11px] text-muted-foreground mb-1">Quick insert — appends {`{{n}}`} to body and binds it:</div>
                <div className="flex flex-wrap gap-1">
                  {WA_SYSTEM_VARIABLES.map(v => (
                    <Button
                      key={v.key}
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] font-normal"
                      onClick={() => {
                        const nextN = (extractVars(draft.body_text).at(-1) || 0) + 1;
                        setDraft(d => ({ ...d, body_text: (d.body_text || "") + `{{${nextN}}}` }));
                        setVarKeys(prev => { const c = [...prev]; c[nextN - 1] = v.key; return c; });
                      }}
                    >
                      + {v.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

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

            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Test send</Label>
              <div className="flex gap-2">
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="91XXXXXXXXXX or +91…" className="h-8 text-sm" />
                <Button size="sm" variant="secondary" onClick={testSend} disabled={testing || !isEdit && !draft.name}>
                  {testing && <Loader2 className="h-3 w-3 mr-1 animate-spin"/>}Send test
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground">Requires the template to be APPROVED on Meta. Bypasses cart cooldown but still respects opt-outs.</div>
            </div>

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
