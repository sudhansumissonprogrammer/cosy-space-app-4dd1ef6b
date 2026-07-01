import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUSES = ["pending", "sending", "sent", "skipped", "failed"] as const;

export function AdminQueueTab() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<typeof STATUSES[number]>("pending");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const out: Record<string, number> = {};
    for (const s of STATUSES) {
      const { count } = await supabase.from("wa_send_queue" as any).select("id", { count: "exact", head: true }).eq("status", s);
      out[s] = count ?? 0;
    }
    setCounts(out);
    const { data } = await supabase.from("wa_send_queue" as any)
      .select("id, store_id, recipient_phone, template_name, status, attempts, last_error, last_error_class, scheduled_at, created_at")
      .eq("status", filter).order("created_at", { ascending: false }).limit(1000);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const runNow = async () => {
    const { error } = await supabase.functions.invoke("wa-queue-worker");
    if (error) toast.error(error.message); else { toast.success("Worker triggered"); load(); }
  };

  const requeue = async (id: string) => {
    const { error } = await supabase.from("wa_send_queue" as any).update({ status: "pending", attempts: 0, scheduled_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const bulkRequeue = async () => {
    if (!confirm("Requeue all failed sends from the last 24h?")) return;
    const { data, error } = await supabase.rpc("admin_wa_requeue_failed" as any, {});
    if (error) toast.error(error.message); else { toast.success(`Requeued ${data ?? 0}`); load(); }
  };

  const purgeMarketing = async () => {
    if (!confirm("Purge ALL pending marketing sends? Transactional messages are preserved.")) return;
    const { data, error } = await supabase.rpc("admin_wa_purge_marketing" as any);
    if (error) toast.error(error.message); else { toast.warning(`Purged ${data ?? 0} pending marketing rows`); load(); }
  };


  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send queue</CardTitle>
          <CardDescription>Every message is queued before dispatch. Retries: 1m → 5m → 30m → 2h.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
                {s} <Badge className="ml-2" variant="secondary">{counts[s] ?? 0}</Badge>
              </Button>
            ))}
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={bulkRequeue}>Requeue failed (24h)</Button>
            <Button size="sm" variant="outline" onClick={purgeMarketing}>Purge marketing</Button>
            <Button size="sm" variant="secondary" onClick={runNow}>Run worker now</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <Card>
          <CardContent className="p-0 divide-y">
            {rows.map((r) => (
              <div key={r.id} className="p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs">{r.recipient_phone}</span>
                  <span className="text-muted-foreground">{r.template_name}</span>
                  <Badge variant={r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">attempts {r.attempts}</span>
                  <div className="flex-1" />
                  {r.status === "failed" && <Button size="sm" variant="outline" onClick={() => requeue(r.id)}>Requeue</Button>}
                </div>
                {r.last_error && <p className="text-[11px] text-muted-foreground truncate mt-1">{r.last_error_class}: {r.last_error}</p>}
              </div>
            ))}
            {!rows.length && <div className="p-6 text-sm text-muted-foreground">Empty.</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
