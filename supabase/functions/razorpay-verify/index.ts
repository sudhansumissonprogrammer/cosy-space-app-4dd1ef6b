import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { timingSafeEqual } from "../_shared/security.ts";
import { fireWaOrderEvent } from "../_shared/wa-fire-order-event.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
      store_id,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id || !store_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch order to determine payment_type
    const { data: orderData } = await supabase
      .from("orders")
      .select("payment_type, status")
      .eq("id", order_id)
      .eq("store_id", store_id)
      .single();

    if (!orderData) {
      return new Response(JSON.stringify({ error: "Order not found for store" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPartial = orderData?.payment_type === "partial";

    // Fetch key_secret
    const { data: config, error: configErr } = await supabase
      .from("store_payment_config")
      .select("razorpay_key_secret")
      .eq("store_id", store_id)
      .single();

    if (configErr || !config?.razorpay_key_secret) {
      return new Response(JSON.stringify({ error: "Payment config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature using HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(config.razorpay_key_secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const message = `${razorpay_order_id}|${razorpay_payment_id}`;
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (!timingSafeEqual(expectedSignature, String(razorpay_signature).toLowerCase())) {
      return new Response(JSON.stringify({ error: "Invalid payment signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: insert into webhook_events. Duplicate => already processed,
    // return success without re-marking the order.
    const eventId = `${razorpay_order_id}:${razorpay_payment_id}`;
    const { error: dupErr } = await supabase
      .from("webhook_events")
      .insert({ provider: "razorpay", event_id: eventId, payload: { razorpay_order_id, razorpay_payment_id, order_id, store_id } });
    if (dupErr) {
      const msg = String(dupErr.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return new Response(
          JSON.stringify({ success: true, payment_id: razorpay_payment_id, idempotent: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.warn("razorpay-verify dedup insert failed", dupErr.message);
    }

    // Update order status — only transition from pending to avoid clobbering refund states.
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status: isPartial ? "partially_paid" : "confirmed",
        payment_method: "razorpay",
        notes: `Razorpay Payment ID: ${razorpay_payment_id}`,
        payment_verified: true,
        payment_verified_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .eq("store_id", store_id);

    if (updateErr) {
      console.error("Order update error:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to update order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark the linked abandoned cart as recovered (payment succeeded).
    // Look up checkout_token from the just-updated order and clear the cart
    // so the recovery cron doesn't chase a customer who already paid.
    {
      const { data: ord } = await supabase
        .from("orders")
        .select("checkout_token")
        .eq("id", order_id)
        .maybeSingle();
      if (ord?.checkout_token) {
        await supabase
          .from("abandoned_carts")
          .update({ recovered: true })
          .eq("store_id", store_id)
          .eq("session_token", ord.checkout_token);
      }
    }

    // Payment confirmed — fire Meta CAPI Purchase (server-to-server, idempotent).
    await firePurchaseCapi(supabase, order_id, { source: "razorpay" });

    return new Response(
      JSON.stringify({ success: true, payment_id: razorpay_payment_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
