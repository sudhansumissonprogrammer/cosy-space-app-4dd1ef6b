// Sends ONE follow-up ping for COD orders that were asked to confirm on
// WhatsApp but got no reply within 4 hours. Strictly one per order.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders, isValidCronHeader, normalizePhone,
  loadPlatformConfig, platformConfigUsable,
} from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEMPLATE = "cod_confirm_followup_v1";
const FOLLOWUP_AFTER_HOURS = 4;
const MAX_AGE_HOURS = 48;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  let authorized = await isValidCronHeader(admin, cronHeader);
  if (!authorized) {
    const authHeader = req.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
        authorized = isAdmin === true;
      }
    }
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });

  const { data: tpl } = await admin
    .from("platform_wa_templates")
    .select("is_active, paused, meta_status")
    .eq("name", TEMPLATE)
    .maybeSingle();
  const tplOk = tpl && (tpl as any).is_active && !(tpl as any).paused &&
    String((tpl as any).meta_status || "").toUpperCase() === "APPROVED";
  if (!tplOk) return json({ skipped: true, reason: "no_approved_followup_template" });

  const now = Date.now();
  const dueBefore = new Date(now - FOLLOWUP_AFTER_HOURS * 3600_000).toISOString();
  const notOlderThan = new Date(now - MAX_AGE_HOURS * 3600_000).toISOString();

  const { data: orders } = await admin
    .from("orders")
    .select("id, store_id, customer_phone, customer_name, order_number, total, currency, status, payment_method, payment_type, advance_paid, cod_confirm_status, cod_confirm_followup_at")
    .eq("cod_confirm_status", "awaiting")
    .is("cod_confirm_followup_at", null)
    .lte("cod_confirm_sent_at", dueBefore)
    .gte("cod_confirm_sent_at", notOlderThan)
    .limit(100);

  let queued = 0, skipped = 0;
  for (const o of ((orders as any[]) || [])) {
    // Re-validate: pure COD, still open, store toggle ON.
    const method = String(o.payment_method || "").toLowerCase();
    const ptype = String(o.payment_type || "").toLowerCase();
    if (method !== "cod" || ptype !== "full" || Number(o.advance_paid || 0) > 0) { skipped++; continue; }
    if (["cancelled", "delivered", "shipped"].includes(String(o.status || "").toLowerCase())) { skipped++; continue; }

    const { data: s } = await admin
      .from("stores_wa_settings")
      .select("platform_marketing_enabled, send_cod_confirmation")
      .eq("store_id", o.store_id)
      .maybeSingle();
    if (!s || (s as any).platform_marketing_enabled !== true || (s as any).send_cod_confirmation !== true) {
      skipped++; continue;
    }

    const phone = normalizePhone(o.customer_phone);
    if (!phone) { skipped++; continue; }

    const sym = o.currency === "INR" || !o.currency ? "₹" : `${o.currency} `;
    const { error: qErr } = await admin.from("wa_send_queue").insert({
      store_id: o.store_id,
      recipient_phone: phone,
      recipient_name: o.customer_name || "there",
      template_name: TEMPLATE,
      message_type: "cod_confirm_followup",
      order_id: o.id,
      params: [],
      template_vars: {
        customer_name: o.customer_name || "there",
        order_number: o.order_number || String(o.id).slice(0, 8).toUpperCase(),
        order_total: `${sym}${Number(o.total || 0).toFixed(0)}`,
      },
      priority: 2,
      scheduled_at: new Date().toISOString(),
    } as any);

    if (qErr && (qErr as any).code !== "23505") { skipped++; continue; }

    await admin.from("orders")
      .update({ cod_confirm_followup_at: new Date().toISOString() } as any)
      .eq("id", o.id);
    queued++;
  }

  return json({ ok: true, queued, skipped });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
