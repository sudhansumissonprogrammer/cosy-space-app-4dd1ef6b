import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Template = {
  name: string;
  purpose: string;
  language: string;
  body_preview: string | null;
  variables: string[];
  is_active: boolean;
};

export function AdminPlatformTemplatesTab() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_wa_templates" as any)
      .select("*")
      .order("name");
    if (error) toast.error(error.message);
    else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("platform_wa_templates" as any)
      .upsert(editing as any, { onConflict: "name" });
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const toggleActive = async (name: string, v: boolean) => {
    const { error } = await supabase.from("platform_wa_templates" as any).update({ is_active: v } as any).eq("name", name);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing({ name: "", purpose: "marketing", language: "en", body_preview: "", variables: [], is_active: true })}>+ New template</Button>
      </div>
      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <Card>
          <CardContent className="p-0 divide-y">
            {rows.map((r) => (
              <div key={r.name} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.purpose} · {r.language} · vars: {r.variables.join(", ") || "—"}</p>
                </div>
                <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "active" : "inactive"}</Badge>
                <Switch checked={r.is_active} onCheckedChange={(v) => toggleActive(r.name, v)} />
                <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button>
              </div>
            ))}
            {!rows.length && <div className="p-6 text-sm text-muted-foreground">No templates yet.</div>}
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card>
          <CardHeader><CardTitle className="text-base">Template</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Purpose</Label><Input value={editing.purpose} onChange={(e) => setEditing({ ...editing, purpose: e.target.value })} /></div>
            <div><Label>Language</Label><Input value={editing.language} onChange={(e) => setEditing({ ...editing, language: e.target.value })} /></div>
            <div><Label>Variables (comma-separated)</Label><Input value={editing.variables.join(",")} onChange={(e) => setEditing({ ...editing, variables: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} /></div>
            <div className="sm:col-span-2"><Label>Body preview (for docs only)</Label><Textarea rows={3} value={editing.body_preview ?? ""} onChange={(e) => setEditing({ ...editing, body_preview: e.target.value })} /></div>
            <div className="sm:col-span-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label>
              </div>
              <div className="flex gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save}>Save</Button></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
