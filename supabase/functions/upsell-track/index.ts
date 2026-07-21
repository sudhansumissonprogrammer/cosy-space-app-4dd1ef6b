/**
 * upsell-track: batched event ingest for the Upsell & Cross-sell app.
 * Client sends { events: UpsellEvent[] }; we write to public.upsell_events
 * using service_role (the table's INSERT is service_role-only by policy).
 *
 * verify_jwt = false (public beacon). Rate-limited by IP would live here
 * in Phase 2; for MVP we validate shape + drop malformed rows.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ALLOWED_EVENT_TYPES = new Set(["view", "click", "add", "purchase"]);
const ALLOWED_PLACEMENTS = new Set([
  "pdp",
  "cart_drawer",
  "cart_page",
  "pre_checkout",
  "post_purchase",
]);

interface IncomingEvent {
  store_id?: string;
  offer_id?: string;
  placement?: string;
  event_type?: string;
  product_id?: string | null;
  order_id?: string | null;
  revenue_paise?: number;
  session_id?: string;
  customer_id?: string | null;
  meta?: Record<string, unknown>;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { events?: IncomingEvent[] } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const events = Array.isArray(body.events) ? body.events : [];
  if (!events.length) {
    return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = events
    .filter((e) =>
      isUuid(e.store_id) &&
      typeof e.offer_id === "string" && e.offer_id.length > 0 && e.offer_id.length < 200 &&
      typeof e.placement === "string" && ALLOWED_PLACEMENTS.has(e.placement) &&
      typeof e.event_type === "string" && ALLOWED_EVENT_TYPES.has(e.event_type)
    )
    .slice(0, 100)
    .map((e) => ({
      store_id: e.store_id!,
      offer_id: e.offer_id!,
      placement: e.placement!,
      event_type: e.event_type!,
      product_id: isUuid(e.product_id) ? e.product_id : null,
      order_id: isUuid(e.order_id) ? e.order_id : null,
      revenue_paise: Math.max(0, Math.floor(Number(e.revenue_paise) || 0)),
      session_id: typeof e.session_id === "string" ? e.session_id.slice(0, 100) : null,
      customer_id: isUuid(e.customer_id) ? e.customer_id : null,
      meta: e.meta && typeof e.meta === "object" ? e.meta : null,
    }));

  if (!rows.length) {
    return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey);
  const { error } = await supabase.from("upsell_events").insert(rows);

  if (error) {
    console.error("upsell-track insert failed", error);
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});