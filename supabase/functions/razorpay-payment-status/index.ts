import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";

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
    const { razorpay_payment_id, store_id, order_id } = await req.json();

    if (!store_id || !order_id) {
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
    const { data: orderInfo } = await supabase
      .from("orders")
      .select("payment_type")
      .eq("id", order_id)
      .single();
    const isPartialOrder = orderInfo?.payment_type === "partial";

    // Fetch key
    const { data: config, error: configErr } = await supabase
      .from("store_payment_config")
      .select("razorpay_key_id, razorpay_key_secret")
      .eq("store_id", store_id)
      .single();

    if (configErr || !config?.razorpay_key_secret) {
      return new Response(JSON.stringify({ error: "Payment config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = "Basic " + btoa(`${config.razorpay_key_id}:${config.razorpay_key_secret}`);

    // If no real payment_id (modal dismissed / UPI flow lost), reconcile via Razorpay
    if (!razorpay_payment_id || razorpay_payment_id === "check_order") {
      const { data: order } = await supabase
        .from("orders")
        .select("status, notes, razorpay_order_id")
        .eq("id", order_id)
        .single();

      // Already settled in our DB
      if (order?.status === "confirmed" || order?.status === "partially_paid") {
        return new Response(
          JSON.stringify({ status: "captured", payment_id: order.notes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ask Razorpay if any payment was captured for this rzp order
      if (order?.razorpay_order_id) {
        const rzpRes = await fetch(
          `https://api.razorpay.com/v1/orders/${order.razorpay_order_id}/payments`,
          { headers: { Authorization: authHeader } }
        );
        if (rzpRes.ok) {
          const body = await rzpRes.json();
          const items: any[] = Array.isArray(body?.items) ? body.items : [];
          const captured = items.find((p) => p.status === "captured" || p.status === "authorized");
          if (captured) {
            const newStatus = isPartialOrder ? "partially_paid" : "confirmed";
            await supabase
              .from("orders")
              .update({
                status: newStatus,
                payment_method: "razorpay",
                notes: `Razorpay Payment ID: ${captured.id}`,
              })
              .eq("id", order_id);
            if (captured.status === "authorized") {
              await fetch(`https://api.razorpay.com/v1/payments/${captured.id}/capture`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: authHeader },
                body: JSON.stringify({ amount: captured.amount, currency: captured.currency }),
              });
            }
            // Fire Meta CAPI Purchase (idempotent via meta_purchase_fired_at stamp)
            void firePurchaseCapi(supabase, order_id, { source: "razorpay" });
            return new Response(
              JSON.stringify({ status: "captured", payment_id: captured.id }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ status: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch payment status from Razorpay
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: authHeader },
    });

    if (!payRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch payment status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await payRes.json();
    const status = payment.status; // created, authorized, captured, failed

    // If captured or authorized, update order
    if (status === "captured" || status === "authorized") {
      const newStatus = isPartialOrder ? "partially_paid" : "confirmed";
      await supabase
        .from("orders")
        .update({
          status: newStatus,
          payment_method: "razorpay",
          notes: `Razorpay Payment ID: ${razorpay_payment_id}`,
        })
        .eq("id", order_id);

      // Auto-capture if only authorized
      if (status === "authorized") {
        await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ amount: payment.amount, currency: payment.currency }),
        });
      }
      // Fire Meta CAPI Purchase (idempotent via meta_purchase_fired_at stamp)
      void firePurchaseCapi(supabase, order_id, { source: "razorpay" });
    }

    return new Response(
      JSON.stringify({ status, payment_id: razorpay_payment_id }),
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
