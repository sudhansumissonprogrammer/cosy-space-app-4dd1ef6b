// Cancels a still-pending storefront order.
//
// Called by CheckoutV2 whenever the shopper's payment snapshot changes (Full↔
// Partial toggle, qty +/-, item removed, coupon apply/remove) and the front-end
// is about to mint a fresh order for the new amount. Without this, every
// snapshot change leaves the previous pending row behind → analytics pollution,
// stale-lead spam, and extra load on expire-stale-pending-orders.
//
// Ownership proof: the caller must present the same `checkout_token` that
// place-order stamped on the row. RLS-safe (service role) but scoped by that
// token so a random attacker can't cancel other shoppers' orders.
//
// Idempotent: no-op if already cancelled / not pending / token mismatch.
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
    const { store_id, order_id, checkout_token } = await req.json();
    if (!store_id || !order_id || !checkout_token) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || !uuidRegex.test(order_id)) {
      return jsonRes({ error: "Invalid ID format" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Scoped UPDATE — only flips the row when store_id + token + pending all match.
    // Payment webhooks that arrive between our snapshot-change and this call flip
    // status to `confirmed`/`partially_paid`; the `status=pending` guard makes
    // this call a no-op in that race so we never cancel a paid order.
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order_id)
      .eq("store_id", store_id)
      .eq("checkout_token", checkout_token)
      .eq("status", "pending")
      // A PayU attempt can still settle after the shopper changes the cart.
      // Let the gateway-verified reconciler determine its final status.
      .or("payment_method.is.null,payment_method.neq.payu")
      .select("id")
      .maybeSingle();

    if (error) return jsonRes({ error: error.message }, 500);
    return jsonRes({ ok: true, cancelled: !!data });
  } catch (err) {
    console.error("cancel-pending-order error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
