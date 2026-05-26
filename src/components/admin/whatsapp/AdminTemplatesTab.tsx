import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Clock, Trash2, Plus, Loader2, RefreshCw,
} from "lucide-react";

export function AdminTemplatesTab() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "MARKETING", language: "en", body: "" });
  const [selectedStoreId, setSelectedStoreId] = useState("");

  const { data: templates } = useQuery({
    queryKey: ["admin-all-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*, stores:store_id(name)")
        .neq("meta_status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["admin-stores-for-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name").limit(10);
      return data || [];
    },
  });

  const syncFromMeta = async () => {
    if (!selectedStoreId) { toast({ title: "Select a store first", variant: "destructive" }); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", { body: { action: "sync", store_id: selectedStoreId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Templates synced!", description: `${(data as any)?.count || 0} templates found` });
      queryClient.invalidateQueries({ queryKey: ["admin-all-templates"] });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  const submitTemplate = async () => {
    if (!selectedStoreId || !newTemplate.name || !newTemplate.body) {
      toast({ title: "Fill all fields and select a store", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "submit", store_id: selectedStoreId, template_name: newTemplate.name,
          template_category: newTemplate.category, template_body: newTemplate.body, template_language: newTemplate.language },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Template submitted!" });
      setShowCreate(false);
      setNewTemplate({ name: "", category: "MARKETING", language: "en", body: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-templates"] });
    } catch (e: any) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const deleteTemplate = async (templateName: string, storeId: string) => {
    try {
      await supabase.functions.invoke("whatsapp-templates", { body: { action: "delete", store_id: storeId, template_name: templateName } });
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-templates"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED": return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Approved</Badge>;
      case "PENDING": return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>;
      case "REJECTED": return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]"><XCircle className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">All Templates</h3>
          <p className="text-sm text-muted-foreground">Manage Meta templates across all stores</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-[180px] text-sm"><SelectValue placeholder="Select store..." /></SelectTrigger>
            <SelectContent>{stores?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={syncFromMeta} disabled={syncing || !selectedStoreId}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}Sync
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus className="h-3.5 w-3.5 mr-1" /> Create</Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create Template</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label>
                <Input value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} placeholder="e.g. promo_v1" className="text-sm" /></div>
              <div className="space-y-2"><Label>Category</Label>
                <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Body</Label>
              <Textarea value={newTemplate.body} onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })} rows={4} className="text-sm" placeholder="Hello {{1}}, we have a special offer..." />
            </div>
            <Button onClick={submitTemplate} disabled={submitting || !selectedStoreId}>{submitting ? "Submitting..." : "Submit to Meta"}</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {templates?.map((t: any) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.template_name}</span>
                  {statusBadge(t.meta_status)}
                  <Badge variant="outline" className="text-[9px]">{t.meta_category}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{t.stores?.name || "Unknown"}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTemplate(t.template_name, t.store_id)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{t.body_text}</p>
            </CardContent>
          </Card>
        ))}
        {!templates?.length && <p className="text-sm text-muted-foreground text-center py-8">No templates found. Select a store and sync from Meta.</p>}
      </div>
    </div>
  );
}
