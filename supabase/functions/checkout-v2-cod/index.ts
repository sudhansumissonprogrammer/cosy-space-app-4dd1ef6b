// Finalize a CheckoutV2 pending order as COD.
//
// CheckoutV2 pre-creates the order as `status=pending, payment_method=razorpay`
// (placeholder) so UPI intents can be generated in parallel. If the shopper
// picks Cash-on-Delivery instead, this endpoint flips that order to
// `status=confirmed, payment_method=cod` server-side (RLS blocks storefront
// customers from UPDATEing orders directly).
//
// Safe: only mutates orders that are still `pending` AND belong to the given
// store, and only if the store actually has COD enabled in payment_methods.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const { store_id, order_id } = await req.json();
    if (!store_id || !order_id) return jsonRes({ error: "Missing required fields" }, 400);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || !uuidRegex.test(order_id)) {
      return jsonRes({ error: "Invalid ID format" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify store allows COD
    const { data: config } = await supabase
      .from("store_payment_config")
      .select("payment_methods")
      .eq("store_id", store_id)
      .single();

    const methods = Array.isArray(config?.payment_methods) ? (config!.payment_methods as string[]) : [];
    if (!methods.includes("cod")) {
      return jsonRes({ error: "COD not enabled for this store" }, 400);
    }

    // Fetch the order and validate ownership + pending state
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, store_id, status, payment_type")
      .eq("id", order_id)
      .maybeSingle();
    if (fetchErr || !order) return jsonRes({ error: "Order not found" }, 404);
    if (order.store_id !== store_id) return jsonRes({ error: "Order/store mismatch" }, 403);

    // Already-processed guard (idempotent)
    if (order.status === "confirmed" || order.status === "partially_paid" || order.status === "paid") {
      return jsonRes({ ok: true, already: true, order_id });
    }
    if (order.status !== "pending") {
      return jsonRes({ error: `Cannot convert order in status=${order.status}` }, 409);
    }

    // For partial-payment orders, COD "top up" doesn't apply — reject.
    if (order.payment_type === "partial") {
      return jsonRes({ error: "Partial-payment orders cannot be finalized as COD" }, 400);
    }

    const { error: updErr } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        payment_method: "cod",
        payment_type: "full",
      })
      .eq("id", order_id)
      .eq("store_id", store_id)
      .eq("status", "pending"); // race guard
    if (updErr) return jsonRes({ error: updErr.message }, 500);

    return jsonRes({ ok: true, order_id });
  } catch (err) {
    console.error("checkout-v2-cod error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
