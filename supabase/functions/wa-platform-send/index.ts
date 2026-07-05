// Single sender for all platform WhatsApp messages.
// Uses platform_config.wa_* credentials. Enforces: kill switch, opt-outs,
// per-store toggle (when called from automation), daily-per-phone cap.
// When called with store_id and a known template, auto-resolves branding vars.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, loadPlatformConfig, platformConfigUsable, isValidCronHeader, metaFetch } from "../_shared/wa-platform.ts";
import { loadStore, loadTemplate, resolveTemplateParams, pickLocaleVariant, sanitizeWaParam } from "../_shared/wa-branding.ts";

type Body = {
  mode?: "automation" | "test" | "text";
  store_id?: string | null;
  recipient_phone: string;
  recipient_name?: string | null;
  template_name?: string;
  template_params?: string[];                // legacy positional
  template_vars?: Record<string, string>;    // preferred — keyed by variable name
  language?: string;
  message_type?: string;
  order_id?: string | null;
  abandoned_cart_id?: string | null;
  // Session-window text reply (admin inbox). Only allowed within 24h of last inbound.
  message_body?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Meta error codes that should NOT be retried (invalid phone, opt-out, template missing,
// re-engagement window, business locked, account paused, etc.). Treating them as permanent
// stops retry storms that hurt the quality rating.
const PERMANENT_META_CODES = new Set([
  100, 190, 200, 4,                                  // auth / param / permission
  131026, 131047, 131048, 131049, 131051, 131056,    // delivery / re-engagement / unsupported
  132000, 132001, 132005, 132007, 132012, 132015, 132016, 132068, 132069, // template errors
  130429, 130472,                                    // user in experiment / spend cap
  368,                                               // temporarily blocked for policy violation
]);

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
  const isTextReply = body.mode === "text";
  if (!isTextReply && !body.template_name) return json({ error: "template_name required", error_class: "permanent" }, 400);

  if (!isInternal) {
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized", error_class: "permanent" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized", error_class: "permanent" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      // Store owners may only send 24h session text replies for their own store.
      // Automation/templates remain admin/internal-only so merchants cannot bypass
      // platform campaign controls or broadcast limits.
      if (!isTextReply || !body.store_id) return json({ error: "forbidden", error_class: "permanent" }, 403);
      const { data: storeRow } = await admin
        .from("stores")
        .select("owner_id")
        .eq("id", body.store_id)
        .maybeSingle();
      if ((storeRow as any)?.owner_id !== user.id) return json({ error: "forbidden", error_class: "permanent" }, 403);
    }
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

  // Per-store toggles — DEFAULT OFF. Missing row = no consent = skip.
  if (body.mode === "automation" && body.store_id) {
    const { data: s } = await admin
      .from("stores_wa_settings")
      .select("platform_marketing_enabled, send_order_confirmation, send_order_shipped, send_abandoned_cart")
      .eq("store_id", body.store_id)
      .maybeSingle();
    if (!s || (s as any).platform_marketing_enabled !== true) {
      return json({ skipped: true, reason: "store_disabled" });
    }
    // Per-event guard (defense-in-depth against callers that skip wa-order-event).
    // Abandoned-cart recovery is the baseline marketing automation: the cron
    // enqueues it when the store master switch is ON, so the sender must not
    // block it again on the legacy sub-toggle.
    const mt = body.message_type || "";
    const perEventOk =
      (mt === "order_confirmation" && (s as any).send_order_confirmation === true) ||
      (mt === "order_shipped" && (s as any).send_order_shipped === true) ||
      mt === "abandoned_cart";
    if (!perEventOk) {
      return json({ skipped: true, reason: "event_toggle_off" });
    }
  }

  // Daily cap — applies to MARKETING only. Transactional events (order/payment/shipping)
  // must always reach the customer and are excluded from the cap.
  const TRANSACTIONAL = new Set(["order_confirmation", "payment_received", "payment_success", "order_shipped", "order_delivered"]);
  const isTransactional = TRANSACTIONAL.has(body.message_type || "");
  if (!isTransactional) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Count MARKETING messages only — transactional sends (order confirmation,
    // shipping, payment) must not consume the marketing cap.
    const { count: sentToday } = await admin
      .from("whatsapp_messages").select("id", { count: "exact", head: true })
      .eq("recipient_phone", phone).eq("sent_via", "platform").eq("direction", "outgoing")
      .not("message_type", "in", `(${Array.from(TRANSACTIONAL).map((t) => `"${t}"`).join(",")})`)
      .gte("created_at", since);
    if ((sentToday ?? 0) >= cfg!.wa_daily_cap_per_phone) return json({ skipped: true, reason: "daily_cap" });
  }

  // Quality auto-throttle — pause MARKETING when Meta drops quality to YELLOW/RED.
  if (!isTransactional && (cfg as any)?.wa_throttle_marketing === true) {
    return json({ skipped: true, reason: "quality_throttle", error_class: "transient" });
  }

  // Per-sender (whole platform number) daily tier limit — protects Meta messaging tier.
  // Meta meters DISTINCT recipients in 24h, not total messages. Counting messages
  // would over-throttle legitimate transactional retries / multi-template flows.
  const tierLimit = Number((cfg as any)?.wa_tier_limit ?? 250);
  if (tierLimit > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recents } = await admin
      .from("whatsapp_messages")
      .select("recipient_phone")
      .eq("sent_via", "platform").eq("direction", "outgoing").eq("status", "sent")
      .gte("created_at", since)
      .limit(20000);
    const uniq = new Set<string>();
    for (const r of (recents as any[]) ?? []) if (r?.recipient_phone) uniq.add(String(r.recipient_phone));
    if (!uniq.has(phone) && uniq.size >= tierLimit) {
      return json({ skipped: true, reason: "tier_limit", error_class: "transient" });
    }
  }


  let metaPayload: any;
  if (isTextReply) {
    // 24h session window check — Meta only accepts free-form text within 24h of last user message.
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let lastInQuery = admin
      .from("whatsapp_messages")
      .select("id")
      .eq("direction", "incoming")
      .or(`sender_phone.eq.${phone},recipient_phone.eq.${phone}`)
      .gte("created_at", windowStart);
    if (body.store_id) {
      lastInQuery = lastInQuery.or(`store_id.eq.${body.store_id},inferred_store_id.eq.${body.store_id}`);
    }
    const { data: lastIn } = await lastInQuery.limit(1).maybeSingle();
    if (!lastIn) return json({ error: "outside_24h_session", error_class: "permanent" }, 400);
    if (!body.message_body) return json({ error: "message_body required", error_class: "permanent" }, 400);
    metaPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: body.message_body.slice(0, 4096) },
    };
  } else {
    // Resolve template + branding. Also enforce that template is APPROVED at Meta
    // (once template-sync has populated meta_status). Pre-sync (meta_status NULL) is allowed.
    const [tplRaw, store] = await Promise.all([
      loadTemplate(admin, body.template_name!),
      loadStore(admin, body.store_id || null),
    ]);
    // Pick locale variant inside the same template_group when caller asks for a non-default language.
    const tpl = await pickLocaleVariant(admin, tplRaw, body.language || null);

    const tplStatus = (tpl as any)?.meta_status as string | null | undefined;
    if ((tpl as any)?.paused === true) {
      return json({ error: `template_paused:${(tpl as any)?.pause_reason || "manual"}`, error_class: "permanent" }, 400);
    }
    if (tplStatus && tplStatus.toLowerCase() !== "approved") {
      return json({ error: `template_not_approved:${tplStatus}`, error_class: "permanent" }, 400);
    }

    let finalParams: string[] = body.template_params || [];
    let extras: Record<string, string> = {};
    if (body.template_vars || body.store_id) {
      extras = { ...(body.template_vars || {}) } as Record<string, string>;
      if (body.recipient_name && !extras.customer_name) extras.customer_name = body.recipient_name;
      if (tpl) finalParams = resolveTemplateParams(tpl as any, store, extras);
    }
    const params = finalParams.map((t) => ({ type: "text", text: String(t ?? "") }));

    // 🔘 Button URL parameters. Meta scopes button {{n}} separately from body.
    // For every URL button whose URL contains a variable we must add a button
    // component or Meta returns (#132000) param-count-mismatch. We use cta_token
    // (set by producers; resolves to /r/<token>) for the single param all our
    // current templates have.
    const buttonComponents: any[] = [];
    const tplButtons = ((tpl as any)?.buttons || []) as Array<{ type: string; url?: string; text?: string }>;
    tplButtons.forEach((b, i) => {
      if (b?.type === "URL" && typeof b.url === "string" && b.url.includes("{{")) {
        const tok = sanitizeWaParam(extras.cta_token || extras.cta || "x", 64);
        buttonComponents.push({
          type: "button",
          sub_type: "url",
          index: String(i),
          parameters: [{ type: "text", text: tok }],
        });
      }
    });

    const components: any[] = [];
    // Header media (IMAGE/VIDEO/DOCUMENT). Allow per-send override via extras.header_media_url.
    const headerFmt = (tpl as any)?.header_type as string | null | undefined;
    const headerUrl = (extras.header_media_url as string) || (tpl as any)?.header_media_url || null;
    if (headerUrl && (headerFmt === "IMAGE" || headerFmt === "VIDEO" || headerFmt === "DOCUMENT")) {
      const key = headerFmt.toLowerCase();
      const mediaParam: any = headerFmt === "DOCUMENT"
        ? { type: "document", document: { link: headerUrl, filename: (extras.header_filename as string) || "document.pdf" } }
        : { type: key, [key]: { link: headerUrl } };
      components.push({ type: "header", parameters: [mediaParam] });
    }
    if (params.length) components.push({ type: "body", parameters: params });
    components.push(...buttonComponents);


    metaPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: (tpl as any)?.name || body.template_name,
        language: { code: (tpl as any)?.language || body.language || cfg!.wa_default_lang || "en" },
        components,
      },
    };


  }

  let status = "failed";
  let metaId: string | null = null;
  let errMsg: string | null = null;
  let errCls: "permanent" | "transient" = "transient";

  try {
    const res = await metaFetch(
      admin,
      `https://graph.facebook.com/v21.0/${cfg!.wa_phone_number_id}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg!.wa_access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(metaPayload),
      },
      { source: "wa-platform-send" },
    );
    if (res.breakerOpen) {
      status = "failed";
      errMsg = "meta_breaker_open";
      errCls = "transient";
    } else if (res.ok) {
      status = "sent";
      metaId = res.body?.messages?.[0]?.id ?? null;
    } else {
      errMsg = JSON.stringify(res.body?.error ?? res.body);
      const code = Number(res.body?.error?.code ?? 0);
      errCls = PERMANENT_META_CODES.has(code) ? "permanent" : "transient";
    }
  } catch (e) {
    errMsg = (e as Error).message;
    errCls = "transient";
  }

  await admin.from("whatsapp_messages").insert({
    store_id: body.store_id ?? null,
    message_type: body.message_type || (isTextReply ? "text_reply" : "platform"),
    recipient_phone: phone,
    recipient_name: body.recipient_name ?? null,
    message_body: isTextReply ? (body.message_body || "").slice(0, 4096) : `[template:${body.template_name}]`,
    template_name: isTextReply ? null : body.template_name,
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
