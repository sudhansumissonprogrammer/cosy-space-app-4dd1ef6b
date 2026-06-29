// Single entry point for order-related WhatsApp events.
// Enqueues into wa_send_queue. Branding is resolved at send-time.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, isValidCronHeader, loadPlatformConfig, platformConfigUsable } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Event = "order_confirmation" | "payment_received" | "order_shipped" | "order_delivered" | "review_request";

const TEMPLATE_BY_EVENT: Record<Event, string> = {
  order_confirmation: "order_confirmation_v1",
  payment_received: "payment_success_v1",
  order_shipped: "order_shipped_v1",
  order_delivered: "order_delivered_v1",
  review_request: "review_request_v1",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (!(await isValidCronHeader(admin, cronHeader))) return json({ error: "unauthorized" }, 401);

  let body: { event: Event; order_id: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.event || !body.order_id) return json({ error: "event + order_id required" }, 400);

  const { data: order } = await admin
    .from("orders")
    .select("id, store_id, customer_phone, customer_name, total, currency, tracking_url, order_number, stores:store_id(name, slug, custom_domain)")
    .eq("id", body.order_id).maybeSingle();
  if (!order) return json({ error: "order_not_found" }, 404);

  const phone = normalizePhone((order as any).customer_phone);
  if (!phone) return json({ skipped: true, reason: "no_phone" });

  const o = order as any;
  const orderNum = o.order_number || String(o.id).slice(0, 8).toUpperCase();
  const orderTotal = `${o.currency === "INR" || !o.currency ? "₹" : o.currency + " "}${Number(o.total || 0).toFixed(0)}`;
  const customerName = o.customer_name || "there";
  const s = o.stores || {};
  const base = s.custom_domain ? `https://${s.custom_domain}` : (s.slug ? `https://${s.slug}.shopbanao.in` : "https://shopbanao.in");
  const orderLink = `${base}/account/orders/${o.id}`;
  const trackingUrl = o.tracking_url || orderLink;
  const reviewUrl = `${base}/account/orders/${o.id}#review`;

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
      order_number: orderNum,
      order_total: orderTotal,
      order_link: orderLink,
      tracking_url: trackingUrl,
      review_url: reviewUrl,
    },
    priority: body.event === "order_confirmation" ? 1 : 3,
    scheduled_at: new Date().toISOString(),
  } as any);

  if (qErr) return json({ error: qErr.message }, 500);
  return json({ ok: true, queued: true });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
