// Cron-driven worker. Claims up to N pending wa_send_queue rows with
// FOR UPDATE SKIP LOCKED, fires wa-platform-send, and either marks them
// sent or schedules a retry with exponential backoff.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, isValidCronHeader, getCronSecret, loadPlatformConfig, platformConfigUsable } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BACKOFF_MIN = [1, 5, 30, 120]; // minutes per attempt (1 → 5 → 30 → 2h)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (!(await isValidCronHeader(admin, cronHeader))) {
    return json({ error: "unauthorized" }, 401);
  }

  const cfg = await loadPlatformConfig(admin);
  const batchSize = (cfg as any)?.wa_queue_batch_size || 50;
  const downstreamSecret = (await getCronSecret(admin)) || "";

  // Claim a batch atomically via SQL RPC fallback: select+update by id.
  // We do best-effort: select pending rows due, then update to 'sending' guarded by status=pending.
  const { data: candidates } = await admin
    .from("wa_send_queue")
    .select("id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(batchSize);
  if (!candidates?.length) return json({ processed: 0 });

  const ids = (candidates as any[]).map((r) => r.id);
  const { data: claimed } = await admin
    .from("wa_send_queue")
    .update({ status: "sending", locked_until: new Date(Date.now() + 2 * 60_000).toISOString() } as any)
    .in("id", ids)
    .eq("status", "pending")
    .select("*");

  let sent = 0, retried = 0, failed = 0;
  for (const row of (claimed as any[]) ?? []) {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": downstreamSecret,
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        mode: "automation",
        store_id: row.store_id,
        recipient_phone: row.recipient_phone,
        recipient_name: row.recipient_name,
        template_name: row.template_name,
        template_params: row.params,
        message_type: row.message_type,
        order_id: row.order_id,
        abandoned_cart_id: row.abandoned_cart_id,
      }),
    });
    const j = await resp.json().catch(() => ({}));

    if (resp.ok && j?.success) {
      await admin.from("wa_send_queue").update({
        status: "sent",
        sent_message_id: j?.message_id ?? null,
        locked_until: null,
      } as any).eq("id", row.id);
      sent++;
    } else if (resp.ok && j?.skipped) {
      await admin.from("wa_send_queue").update({
        status: "skipped",
        last_error: j?.reason || "skipped",
        locked_until: null,
      } as any).eq("id", row.id);
    } else {
      const cls = j?.error_class || (resp.status >= 500 || resp.status === 429 ? "transient" : "permanent");
      const attempts = (row.attempts || 0) + 1;
      const isPermanent = cls === "permanent" || attempts >= (row.max_attempts || 4);
      if (isPermanent) {
        await admin.from("wa_send_queue").update({
          status: "failed",
          attempts,
          last_error: typeof j === "string" ? j : JSON.stringify(j),
          last_error_class: cls,
          locked_until: null,
        } as any).eq("id", row.id);
        failed++;
      } else {
        const delayMin = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
        await admin.from("wa_send_queue").update({
          status: "pending",
          attempts,
          scheduled_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
          last_error: typeof j === "string" ? j : JSON.stringify(j),
          last_error_class: cls,
          locked_until: null,
        } as any).eq("id", row.id);
        retried++;
      }
    }
  }

  return json({ processed: (claimed as any[])?.length ?? 0, sent, retried, failed });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
