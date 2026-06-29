// Admin-triggered campaign runner.
// Expands the audience via the expand_campaign_audience RPC (segments) and
// enqueues sends into wa_send_queue. The queue worker handles delivery.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: { campaign_id: string; force?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const { data: camp } = await admin.from("platform_wa_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
  if (!camp) return json({ error: "not_found" }, 404);
  if ((camp as any).status === "running") return json({ error: "already_running" }, 409);

  // Mandatory pre-flight unless explicitly forced by admin.
  const { data: pre, error: preErr } = await admin.rpc("wa_campaign_precheck" as any, { _campaign_id: body.campaign_id });
  if (preErr) return json({ error: "precheck_failed", details: preErr.message }, 500);
  if (!body.force && !(pre as any)?.can_send) {
    return json({ error: "precheck_blocked", precheck: pre }, 412);
  }


  await admin.from("platform_wa_campaigns").update({ status: "running", started_at: new Date().toISOString() } as any).eq("id", body.campaign_id);

  const { data: audience, error: audErr } = await admin.rpc("expand_campaign_audience" as any, {
    _filter: (camp as any).audience_filter || {},
  });
  if (audErr) {
    await admin.from("platform_wa_campaigns").update({ status: "failed", failed_reason: audErr.message } as any).eq("id", body.campaign_id);
    return json({ error: audErr.message }, 500);
  }

  let enqueued = 0, skipped = 0;
  const rows = (audience as any[]) || [];
  const campaignVars = ((camp as any).template_vars as Record<string, string>) || {};
  const scheduledAt = (camp as any).scheduled_at || new Date().toISOString();
  for (const c of rows) {
    const phone = normalizePhone(c.phone);
    if (!phone) { skipped++; continue; }
    const perRecipient = {
      customer_name: c.name || "there",
      store_name: c.store_name || "our store",
      ...campaignVars,
    };
    const { error } = await admin.from("wa_send_queue").insert({
      store_id: c.store_id,
      recipient_phone: phone,
      recipient_name: c.name || null,
      template_name: (camp as any).template_name,
      message_type: "campaign",
      params: [],
      template_vars: perRecipient,
      priority: 7,
      scheduled_at: scheduledAt,
      campaign_id: (camp as any).id,
    } as any);
    if (error) skipped++; else enqueued++;
  }

  await admin.from("platform_wa_campaigns")
    .update({ status: "queued", audience_size: rows.length, queued_count: enqueued } as any)
    .eq("id", body.campaign_id);

  return json({ ok: true, audience: rows.length, enqueued, skipped });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
