// Cron-driven safety net: scans recent delivered messages that don't yet have a
// billing row (trigger missed, webhook race, etc) and invokes charge_wa_conversation.
// Idempotent: the SQL function early-exits when an active window already exists.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const provided = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("s") || "";
  if (CRON_SECRET && provided !== CRON_SECRET) {
    return new Response("forbidden", { status: 403, headers: cors });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // last 30h

  // Pull recently-delivered outgoing messages
  const { data: msgs, error } = await admin
    .from("whatsapp_messages")
    .select("id, store_id, recipient_phone, delivered_at, template_name, message_type, direction, status")
    .eq("status", "delivered")
    .neq("direction", "incoming")
    .not("store_id", "is", null)
    .not("recipient_phone", "is", null)
    .gte("delivered_at", since)
    .limit(2000);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  let checked = 0, charged = 0, errors = 0;
  for (const m of msgs ?? []) {
    checked++;

    // Resolve category
    let category = "marketing";
    if (m.message_type === "text_reply") category = "service";
    else if (m.template_name) {
      const { data: tpl } = await admin
        .from("platform_wa_templates")
        .select("category")
        .eq("name", m.template_name)
        .maybeSingle();
      if (tpl?.category) category = String(tpl.category).toLowerCase();
    }

    const { error: rpcErr } = await admin.rpc("charge_wa_conversation" as any, {
      _store_id: m.store_id,
      _recipient_phone: m.recipient_phone,
      _category: category,
      _message_id: m.id,
      _template_name: m.template_name,
      _delivered_at: m.delivered_at,
    });
    if (rpcErr) errors++;
    else charged++;
  }

  return new Response(JSON.stringify({ ok: true, checked, charged, errors }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
