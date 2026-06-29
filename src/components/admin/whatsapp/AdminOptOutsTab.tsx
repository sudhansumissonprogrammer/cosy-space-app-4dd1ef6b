import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AdminOptOutsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_optouts" as any)
      .select("*")
      .order("opted_out_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!phone) return;
    const { error } = await supabase.from("whatsapp_optouts" as any).insert({ phone, reason: "manual_admin", store_id: null } as any);
    if (error) toast.error(error.message);
    else { toast.success("Opted out"); setPhone(""); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("whatsapp_optouts" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (E.164 no +)" />
        <Button onClick={add}>Add opt-out</Button>
      </div>
      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <Card>
          <CardContent className="p-0 divide-y">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="flex-1 font-mono">{r.phone}</div>
                <div className="text-xs text-muted-foreground">{r.reason || "—"}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.opted_out_at).toLocaleString()}</div>
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Remove</Button>
              </div>
            ))}
            {!rows.length && <div className="p-6 text-sm text-muted-foreground">No opt-outs.</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
