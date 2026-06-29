// Single entry point for order-related WhatsApp events.
// Called fire-and-forget from place-order, payment webhooks, shipping flow.
// Phase 2: this is where we'll branch on whatsapp_mode to send via merchant.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, isValidCronHeader, getCronSecret } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Body = {
  event: "order_confirmation" | "payment_received" | "order_shipped" | "order_delivered" | "review_request";
  order_id: string;
};

const TEMPLATE_BY_EVENT: Record<Body["event"], string> = {
  order_confirmation: "order_confirmation_v1",
  payment_received: "payment_received_v1",
  order_shipped: "order_shipped_v1",
  order_delivered: "order_delivered_v1",
  review_request: "review_request_v1",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (!(await isValidCronHeader(admin, cronHeader))) {
    return json({ error: "unauthorized" }, 401);
  }
  const downstreamSecret = (await getCronSecret(admin)) || "";

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.event || !body.order_id) return json({ error: "event + order_id required" }, 400);

  // admin already created above

  const { data: order } = await admin
    .from("orders")
    .select("id, store_id, customer_phone, customer_name, total, currency, tracking_url, order_number")
    .eq("id", body.order_id)
    .maybeSingle();
  if (!order) return json({ error: "order_not_found" }, 404);

  const phone = normalizePhone((order as any).customer_phone);
  if (!phone) return json({ skipped: true, reason: "no_phone" });

  const { data: store } = await admin.from("stores").select("name").eq("id", (order as any).store_id).maybeSingle();
  const storeName = (store as any)?.name || "Our store";
  const orderNum = (order as any).order_number || String((order as any).id).slice(0, 8).toUpperCase();
  const orderTotal = `${(order as any).currency || "₹"}${(order as any).total || 0}`;
  const trackingUrl = (order as any).tracking_url || "";
  const customerName = (order as any).customer_name || "there";

  const templateName = TEMPLATE_BY_EVENT[body.event];
  const params = pickParams(body.event, { customerName, storeName, orderNum, orderTotal, trackingUrl });

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
      store_id: (order as any).store_id,
      recipient_phone: phone,
      recipient_name: customerName,
      template_name: templateName,
      template_params: params,
      message_type: body.event,
      order_id: (order as any).id,
    }),
  });
  const j = await resp.json().catch(() => ({}));
  return json({ ok: resp.ok, result: j }, resp.ok ? 200 : 502);
});

function pickParams(event: Body["event"], v: { customerName: string; storeName: string; orderNum: string; orderTotal: string; trackingUrl: string }) {
  switch (event) {
    case "order_confirmation": return [v.customerName, v.storeName, v.orderNum, v.orderTotal];
    case "payment_received": return [v.customerName, v.orderTotal, v.orderNum, v.storeName];
    case "order_shipped": return [v.customerName, v.orderNum, v.storeName, v.trackingUrl];
    case "order_delivered": return [v.customerName, v.orderNum, v.storeName];
    case "review_request": return [v.customerName, v.storeName, v.trackingUrl];
  }
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
