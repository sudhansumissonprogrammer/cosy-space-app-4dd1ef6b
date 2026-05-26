import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const PAGE = 50;

export default function AdminPartnerAudit() {
  useDocumentTitle("Partner Audit · Admin");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [target, setTarget] = useState("");
  const [page, setPage] = useState(0);

  const load = async () => {
    setLoading(true);
    let q: any = supabase.from("partner_audit_logs").select("*").order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (action) q = q.eq("action", action);
    if (target) q = q.eq("target_type", target);
    const { data } = await q;
    setRows(data || []); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [action, target, page]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Partner audit log</h1>
        <p className="text-sm text-muted-foreground">Sensitive admin and system actions on the partner program.</p>
      </div>
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Select value={action || "all"} onValueChange={(v) => { setPage(0); setAction(v === "all" ? "" : v); }}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {["set_partner_status","pause_payouts","resume_payouts","wallet_adjustment","set_commission_percentage","create_override","deactivate_override"].map((a) =>
                <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={target || "all"} onValueChange={(v) => { setPage(0); setTarget(v === "all" ? "" : v); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All targets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All targets</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="override">Override</SelectItem>
              <SelectItem value="withdrawal">Withdrawal</SelectItem>
              <SelectItem value="commission">Commission</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
            <Button size="sm" variant="outline" disabled={rows.length < PAGE} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>

        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b align-top hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{r.action}</Badge></td>
                    <td className="px-3 py-2 text-xs">
                      <div className="capitalize">{r.target_type}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{r.target_id?.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{r.actor_role}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{r.actor_user_id?.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.note && <div className="mb-1">{r.note}</div>}
                      {r.new_value && <pre className="max-w-md overflow-x-auto rounded bg-muted/40 p-1 text-[10px]">{JSON.stringify(r.new_value, null, 0)}</pre>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No entries</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
