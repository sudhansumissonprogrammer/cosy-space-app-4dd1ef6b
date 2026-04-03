import { createClient } from "npm:@supabase/supabase-js@2";

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

    // If no real payment_id, check the order status in our DB
    if (!razorpay_payment_id || razorpay_payment_id === "check_order") {
      const { data: order } = await supabase
        .from("orders")
        .select("status, notes")
        .eq("id", order_id)
        .single();

      if (order?.status === "confirmed") {
        return new Response(
          JSON.stringify({ status: "captured", payment_id: order.notes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      await supabase
        .from("orders")
        .update({
          status: "confirmed",
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
