import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function AdminAICampaignWriterTab() {
  const [brief, setBrief] = useState("");
  const [category, setCategory] = useState("marketing");
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    if (!brief.trim()) return toast.error("Describe the campaign first");
    setLoading(true); setDraft(null);
    const { data, error } = await supabase.functions.invoke("wa-ai-template-draft", { body: { brief, category } });
    setLoading(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    setDraft((data as any)?.draft);
  };

  const saveAsTemplate = async () => {
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase.from("platform_wa_templates" as any).upsert({
      name: draft.template_name,
      purpose: "marketing",
      language: "en",
      category: draft.category || "marketing",
      headline: draft.headline || null,
      button_label: draft.button_label || null,
      body_preview: draft.body,
      variables: draft.variables || [],
      is_active: false,
    } as any, { onConflict: "name" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved as draft template. Submit to Meta for approval next.");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI campaign writer</CardTitle>
          <CardDescription>Describe what you want to send. AI drafts a template (variables, headline, button, body). You review and submit it to Meta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><Label>Brief</Label><Input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Diwali 15% off jewellery, expires Nov 5" /></div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="transactional">Transactional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={generate} disabled={loading}>{loading ? "Drafting…" : "Generate draft"}</Button>
        </CardContent>
      </Card>

      {draft && (
        <Card>
          <CardHeader><CardTitle className="text-base">Draft preview</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><Label>Template name</Label><Input value={draft.template_name} onChange={(e) => setDraft({ ...draft, template_name: e.target.value })} /></div>
              <div><Label>Headline</Label><Input value={draft.headline || ""} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} /></div>
              <div><Label>Button label</Label><Input value={draft.button_label || ""} onChange={(e) => setDraft({ ...draft, button_label: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Body</Label><Textarea rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Variables</Label><Input value={(draft.variables || []).join(",")} onChange={(e) => setDraft({ ...draft, variables: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} /></div>
            </div>
            <Button disabled={saving} onClick={saveAsTemplate}>{saving ? "Saving…" : "Save as draft template"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
