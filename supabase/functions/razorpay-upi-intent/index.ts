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
    const { store_id, amount, currency, order_id, email, phone, name, upi_app } = await req.json();

    if (!store_id || !amount || !currency || !order_id || !email || !phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── SECURITY: use DB-stored order total, not client-supplied amount ──
    const { data: dbOrder, error: orderErr } = await supabase
      .from("orders")
      .select("id, store_id, total, payment_status, payment_type, advance_paid")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !dbOrder) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (dbOrder.store_id !== store_id) {
      return new Response(JSON.stringify({ error: "Order/store mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (dbOrder.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "Order already paid" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const chargeAmount = dbOrder.payment_type === "partial" && Number(dbOrder.advance_paid) > 0
      ? Number(dbOrder.advance_paid)
      : Number(dbOrder.total);
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid order total" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const methods = config.payment_methods as string[];
    if (!methods.includes("razorpay") || !config.razorpay_key_id || !config.razorpay_key_secret) {
      return new Response(JSON.stringify({ error: "Razorpay not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = "Basic " + btoa(`${config.razorpay_key_id}:${config.razorpay_key_secret}`);

    // Step 1: Create Razorpay order — uses DB-authoritative amount
    const amountInPaise = Math.round(chargeAmount * 100);
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: currency.toUpperCase(),
        receipt: order_id,
        notes: { order_id, store_id },
      }),
    });

    if (!orderRes.ok) {
      const errBody = await orderRes.text();
      console.error("Razorpay order error:", errBody);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rzpOrder = await orderRes.json();

    // Step 2: Create UPI payment with intent flow via S2S API
    // Map upi_app to specific app handles if needed
    const paymentBody: Record<string, any> = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      order_id: rzpOrder.id,
      email: email,
      contact: phone,
      method: "upi",
      "upi[flow]": "intent",
      description: `Order #${order_id.slice(0, 8)}`,
    };

    const paymentRes = await fetch("https://api.razorpay.com/v1/payments/create/upi", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: new URLSearchParams(paymentBody).toString(),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok || paymentData.error) {
      console.error("Razorpay UPI intent error:", JSON.stringify(paymentData));
      return new Response(
        JSON.stringify({
          error: paymentData.error?.description || "Failed to create UPI payment",
          fallback: true, // Signal frontend to fallback to standard checkout
          razorpay_order_id: rzpOrder.id,
          key_id: config.razorpay_key_id,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_order_id: rzpOrder.id,
        intent_url: paymentData.data?.intent_url || paymentData.intent_url,
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
