// Single entry point for order-related WhatsApp events.
// Enqueues into wa_send_queue. Branding is resolved at send-time.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, isValidCronHeader, loadPlatformConfig, platformConfigUsable } from "../_shared/wa-platform.ts";
import { formatExpectedDelivery, formatPaymentStatusLine, inferCourierName } from "../_shared/wa-content.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Event = "order_confirmation" | "payment_received" | "order_shipped" | "order_delivered" | "review_request";

const TEMPLATE_BY_EVENT: Record<Event, string> = {
  order_confirmation: "order_confirmation_v2",
  payment_received: "payment_success_v1",
  order_shipped: "order_shipped_v2",
  order_delivered: "order_delivered_v1",
  review_request: "review_request_v1",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (!(await isValidCronHeader(admin, cronHeader))) return json({ error: "unauthorized" }, 401);

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });

  let body: { event: Event; order_id: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.event || !body.order_id) return json({ error: "event + order_id required" }, 400);

  // Only these two events are enabled platform-wide right now.
  // Abandoned cart is handled by a separate cron. Everything else is disabled.
  const ALLOWED: Event[] = ["order_confirmation", "order_shipped"];
  if (!ALLOWED.includes(body.event)) {
    return json({ skipped: true, reason: "event_disabled" });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, store_id, customer_phone, customer_name, total, currency, tracking_url, tracking_number, order_number, payment_method, payment_type, advance_paid, balance_due, created_at, stores:store_id(name, slug, custom_domain)")
    .eq("id", body.order_id).maybeSingle();
  if (!order) return json({ error: "order_not_found" }, 404);

  const phone = normalizePhone((order as any).customer_phone);
  if (!phone) return json({ skipped: true, reason: "no_phone" });

  const o = order as any;

  // 🔒 Per-store master switch. If the merchant toggled WhatsApp marketing OFF
  // in their dashboard, do not even enqueue. (wa-platform-send also blocks at
  // dispatch time, but stopping here avoids junk rows + false "queued" stats.)
  const { data: storeSettings } = await admin
    .from("stores_wa_settings")
    .select("platform_marketing_enabled")
    .eq("store_id", o.store_id)
    .maybeSingle();
  if (storeSettings && (storeSettings as any).platform_marketing_enabled === false) {
    return json({ skipped: true, reason: "store_disabled" });
  }

  // Gate: "shipped" must have a tracking number, otherwise customer gets a useless message.
  if (body.event === "order_shipped" && (!o.tracking_number || String(o.tracking_number).trim() === "")) {
    return json({ skipped: true, reason: "no_tracking_number" });
  }

  // 🔒 Idempotency: at most one active row per (order_id, message_type).
  const { data: existing } = await admin
    .from("wa_send_queue")
    .select("id, status")
    .eq("order_id", o.id)
    .eq("message_type", body.event)
    .in("status", ["pending", "sending", "sent", "skipped"])
    .limit(1).maybeSingle();
  if (existing) return json({ ok: true, queued: false, reason: "already_enqueued" });

  const orderNum = o.order_number || String(o.id).slice(0, 8).toUpperCase();
  const sym = o.currency === "INR" || !o.currency ? "₹" : `${o.currency} `;
  const orderTotal = `${sym}${Number(o.total || 0).toFixed(0)}`;
  const customerName = o.customer_name || "there";
  const s = o.stores || {};
  const storeName = s.name || "our store";
  const base = s.custom_domain ? `https://${s.custom_domain}` : (s.slug ? `https://${s.slug}.shopbanao.in` : "https://shopbanao.in");
  const orderLink = `${base}/account/orders/${o.id}`;
  const trackingUrl = o.tracking_url || orderLink;
  const reviewUrl = `${base}/account/orders/${o.id}#review`;

  // Delivery ETA: confirmation = 6 days from order date; shipped = 4 days from ship time.
  const etaFrom = body.event === "order_shipped" ? new Date() : new Date(o.created_at || Date.now());
  const etaDays = body.event === "order_shipped" ? 4 : 6;
  const expectedDelivery = formatExpectedDelivery(etaFrom, etaDays);

  const paymentStatusLine = formatPaymentStatusLine(o);
  const courierName = inferCourierName(o.tracking_url, "Courier partner");

  const { error: qErr } = await admin.from("wa_send_queue").insert({
    store_id: o.store_id,
    recipient_phone: phone,
    recipient_name: customerName,
    template_name: TEMPLATE_BY_EVENT[body.event],
    message_type: body.event,
    order_id: o.id,
    params: [],
    template_vars: {
      customer_name: customerName,
      store_name: storeName,
      order_number: orderNum,
      order_total: orderTotal,
      item_count: String(Array.isArray((o as any).items) ? (o as any).items.length : ((o as any).item_count ?? 1)),
      payment_status_line: paymentStatusLine,
      expected_delivery: expectedDelivery,
      order_link: orderLink,
      tracking_url: trackingUrl,
      tracking_number: o.tracking_number || "",
      courier_name: courierName,
      review_url: reviewUrl,
    },
    priority: body.event === "order_confirmation" ? 1 : 3,
    scheduled_at: new Date().toISOString(),
  } as any);

  // 23505 = unique_violation from the partial unique index → treat as dedup, not error.
  if (qErr) {
    if ((qErr as any).code === "23505") return json({ ok: true, queued: false, reason: "already_enqueued" });
    return json({ error: qErr.message }, 500);
  }
  return json({ ok: true, queued: true });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
