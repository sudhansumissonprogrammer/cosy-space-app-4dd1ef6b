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
    const { store_id, amount, currency, order_id } = await req.json();

    if (!store_id || !amount || !currency || !order_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || !uuidRegex.test(order_id)) {
      return new Response(JSON.stringify({ error: "Invalid ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate amount is a positive number and within reasonable bounds
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 10000000) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate currency format (3-letter code)
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency.toUpperCase())) {
      return new Response(JSON.stringify({ error: "Invalid currency" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch store payment config
    const { data: config, error: configErr } = await supabase
      .from("store_payment_config")
      .select("razorpay_key_id, razorpay_key_secret, payment_methods")
      .eq("store_id", store_id)
      .single();

    if (configErr || !config) {
      return new Response(JSON.stringify({ error: "Payment config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const methods = Array.isArray(config.payment_methods) ? config.payment_methods : [];
    if (!methods.includes("razorpay") || !config.razorpay_key_id || !config.razorpay_key_secret) {
      return new Response(JSON.stringify({ error: "Razorpay not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Razorpay order
    const amountInPaise = Math.round(amount * 100);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + btoa(`${config.razorpay_key_id}:${config.razorpay_key_secret}`),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: currency.toUpperCase(),
        receipt: order_id,
        notes: { order_id, store_id },
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      console.error("Razorpay error:", errBody);
      return new Response(JSON.stringify({ error: "Failed to create Razorpay order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rzpOrder = await rzpRes.json();

    return new Response(
      JSON.stringify({
        razorpay_order_id: rzpOrder.id,
        key_id: config.razorpay_key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
      }),
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
