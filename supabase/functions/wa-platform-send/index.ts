// Single sender for all platform WhatsApp messages.
// Uses platform_config.wa_* credentials. Enforces: kill switch, opt-outs,
// per-store toggle (when called from automation), daily-per-phone cap.
// When called with store_id and a known template, auto-resolves branding vars.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, loadPlatformConfig, platformConfigUsable, isValidCronHeader } from "../_shared/wa-platform.ts";
import { loadStore, loadTemplate, resolveTemplateParams } from "../_shared/wa-branding.ts";

type Body = {
  mode?: "automation" | "test";
  store_id?: string | null;
  recipient_phone: string;
  recipient_name?: string | null;
  template_name: string;
  template_params?: string[];                // legacy positional
  template_vars?: Record<string, string>;    // preferred — keyed by variable name
  language?: string;
  message_type?: string;
  order_id?: string | null;
  abandoned_cart_id?: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Meta error codes that should NOT be retried (invalid phone, opt-out, etc.)
const PERMANENT_META_CODES = new Set([131026, 131047, 131048, 131049, 131051, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 132068, 132069, 100, 190, 200, 4]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const authHeader = req.headers.get("Authorization") || "";
  const cronHeader = req.headers.get("x-cron-secret") || "";
  let isInternal = false;
  if (cronHeader && (await isValidCronHeader(admin, cronHeader))) isInternal = true;

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "bad json", error_class: "permanent" }, 400); }

  const phone = normalizePhone(body.recipient_phone);
  if (!phone) return json({ error: "invalid phone", error_class: "permanent" }, 400);
  if (!body.template_name) return json({ error: "template_name required", error_class: "permanent" }, 400);

  if (!isInternal) {
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized", error_class: "permanent" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized", error_class: "permanent" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden", error_class: "permanent" }, 403);
  }

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ error: "wa_disabled", reason: "platform_config", error_class: "transient" }, 400);

  // Pilot cohort guard
  if ((cfg as any)?.wa_pilot_mode && body.mode === "automation" && body.store_id) {
    const cohort: string[] = (cfg as any).wa_pilot_cohort || [];
    if (!cohort.includes(body.store_id)) {
      return json({ skipped: true, reason: "not_in_pilot" });
    }
  }

  // Opt-out
  const { data: optout } = await admin.from("whatsapp_optouts").select("id").eq("phone", phone).limit(1).maybeSingle();
  if (optout) return json({ skipped: true, reason: "opted_out" });

  // Per-store toggle
  if (body.mode === "automation" && body.store_id) {
    const { data: s } = await admin.from("stores_wa_settings").select("platform_marketing_enabled").eq("store_id", body.store_id).maybeSingle();
    if (s && (s as any).platform_marketing_enabled === false) return json({ skipped: true, reason: "store_disabled" });
  }

  // Daily cap
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: sentToday } = await admin
    .from("whatsapp_messages").select("id", { count: "exact", head: true })
    .eq("recipient_phone", phone).eq("sent_via", "platform").gte("created_at", since);
  if ((sentToday ?? 0) >= cfg!.wa_daily_cap_per_phone) return json({ skipped: true, reason: "daily_cap" });

  // Resolve params (template_vars wins over positional)
  let finalParams: string[] = body.template_params || [];
  if (body.template_vars || body.store_id) {
    const [tpl, store] = await Promise.all([
      loadTemplate(admin, body.template_name),
      loadStore(admin, body.store_id || null),
    ]);
    const extras = { ...(body.template_vars || {}) } as Record<string, string>;
    if (body.recipient_name && !extras.customer_name) extras.customer_name = body.recipient_name;
    if (tpl) finalParams = resolveTemplateParams(tpl, store, extras);
  }

  const params = finalParams.map((t) => ({ type: "text", text: String(t ?? "") }));
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
  let errCls: "permanent" | "transient" = "transient";

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${cfg!.wa_phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg!.wa_access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(metaPayload),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      status = "sent";
      metaId = j?.messages?.[0]?.id ?? null;
    } else {
      errMsg = JSON.stringify(j?.error ?? j);
      const code = Number(j?.error?.code ?? 0);
      errCls = PERMANENT_META_CODES.has(code) ? "permanent" : "transient";
    }
  } catch (e) {
    errMsg = (e as Error).message;
    errCls = "transient";
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

  if (status !== "sent") return json({ error: "send_failed", details: errMsg, error_class: errCls }, 502);
  return json({ success: true, message_id: metaId });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
