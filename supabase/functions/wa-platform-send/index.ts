// Single sender for all platform WhatsApp messages.
// Uses platform_config.wa_* credentials. Enforces: kill switch, opt-outs,
// per-store toggle (when called from automation), daily-per-phone cap.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, loadPlatformConfig, platformConfigUsable, isValidCronHeader } from "../_shared/wa-platform.ts";

type Body = {
  mode?: "automation" | "test";
  store_id?: string | null;
  recipient_phone: string;
  recipient_name?: string | null;
  template_name: string;
  template_params?: string[];
  language?: string;
  message_type?: string; // abandoned_cart | order_confirmation | ...
  order_id?: string | null;
  abandoned_cart_id?: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // AuthN: either an admin user JWT, an internal call with CRON_SECRET, or an internal call
  // from another edge function (service role header). Simpler: require either auth user OR cron header.
  const authHeader = req.headers.get("Authorization") || "";
  const cronHeader = req.headers.get("x-cron-secret") || "";
  let isInternal = false;
  if (cronHeader && (await isValidCronHeader(admin, cronHeader))) {
    isInternal = true;
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const phone = normalizePhone(body.recipient_phone);
  if (!phone) return json({ error: "invalid phone" }, 400);
  if (!body.template_name) return json({ error: "template_name required" }, 400);

  // For non-internal calls, require an admin user. (Test send from admin UI.)
  if (!isInternal) {
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);
  }

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ error: "wa_disabled", reason: "platform_config" }, 400);

  // Opt-out check (global rows have store_id=null)
  const { data: optout } = await admin
    .from("whatsapp_optouts")
    .select("id")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();
  if (optout) return json({ skipped: true, reason: "opted_out" }, 200);

  // Per-store toggle (only when invoked from automation flow with a store_id)
  if (body.mode === "automation" && body.store_id) {
    const { data: s } = await admin
      .from("stores_wa_settings")
      .select("platform_marketing_enabled")
      .eq("store_id", body.store_id)
      .maybeSingle();
    if (s && (s as any).platform_marketing_enabled === false) {
      return json({ skipped: true, reason: "store_disabled" }, 200);
    }
  }

  // Daily-per-phone cap
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: sentToday } = await admin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_phone", phone)
    .eq("sent_via", "platform")
    .gte("created_at", since);
  if ((sentToday ?? 0) >= cfg!.wa_daily_cap_per_phone) {
    return json({ skipped: true, reason: "daily_cap" }, 200);
  }

  const params = (body.template_params || []).map((t) => ({ type: "text", text: String(t ?? "") }));
  const metaPayload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: body.template_name,
      language: { code: body.language || cfg!.wa_default_lang || "en" },
      components: params.length ? [{ type: "body", parameters: params }] : [],
    },
  };

  let status = "failed";
  let metaId: string | null = null;
  let errMsg: string | null = null;

  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${cfg!.wa_phone_number_id}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg!.wa_access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(metaPayload),
      },
    );
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      status = "sent";
      metaId = j?.messages?.[0]?.id ?? null;
    } else {
      errMsg = JSON.stringify(j?.error ?? j);
    }
  } catch (e) {
    errMsg = (e as Error).message;
  }

  await admin.from("whatsapp_messages").insert({
    store_id: body.store_id ?? null,
    message_type: body.message_type || "platform",
    recipient_phone: phone,
    recipient_name: body.recipient_name ?? null,
    message_body: `[template:${body.template_name}]`,
    template_name: body.template_name,
    meta_message_id: metaId,
    status,
    error_message: errMsg,
    order_id: body.order_id ?? null,
    abandoned_cart_id: body.abandoned_cart_id ?? null,
    direction: "outgoing",
    sent_via: "platform",
  });

  if (status !== "sent") return json({ error: "send_failed", details: errMsg }, 502);
  return json({ success: true, message_id: metaId }, 200);
});

function json(b: unknown, s: number) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
