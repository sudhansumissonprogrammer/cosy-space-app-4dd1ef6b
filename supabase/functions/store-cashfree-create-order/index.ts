// Per-store Cashfree gateway: creates an order on the merchant's OWN Cashfree account.
// This is intentionally separate from the SaaS billing function "cashfree-create-order"
// which uses the platform's CASHFREE_APP_ID/CASHFREE_SECRET_KEY env vars.
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

  try {
    const { store_id, amount, currency, order_id, customer_name, customer_phone, customer_email } =
      await req.json();

    if (!store_id || !amount || !currency || !order_id) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || !uuidRegex.test(order_id)) {
      return jsonRes({ error: "Invalid ID format" }, 400);
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 10_000_000) {
      return jsonRes({ error: "Invalid amount" }, 400);
    }
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency.toUpperCase())) {
      return jsonRes({ error: "Invalid currency" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── SECURITY: load the order from DB and use the canonical total ──
    // Never trust client-supplied `amount` — could be tampered to ₹1.
    const { data: dbOrder, error: orderErr } = await supabase
      .from("orders")
      .select("id, store_id, total, payment_status, payment_type, advance_paid")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !dbOrder) return jsonRes({ error: "Order not found" }, 404);
    if (dbOrder.store_id !== store_id) return jsonRes({ error: "Order/store mismatch" }, 403);
    if (dbOrder.payment_status === "paid") return jsonRes({ error: "Order already paid" }, 409);
    const chargeAmount = dbOrder.payment_type === "partial" && Number(dbOrder.advance_paid) > 0
      ? Number(dbOrder.advance_paid)
      : Number(dbOrder.total);
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      return jsonRes({ error: "Invalid order total" }, 400);
    }

    // Read merchant's own Cashfree credentials
    const { data: config, error: configErr } = await supabase
      .from("store_payment_config")
      .select("cashfree_app_id, cashfree_secret_key, cashfree_env, payment_methods")
      .eq("store_id", store_id)
      .single();

    if (configErr || !config) return jsonRes({ error: "Payment config not found" }, 404);

    const methods = Array.isArray(config.payment_methods) ? config.payment_methods : [];
    if (!methods.includes("cashfree") || !config.cashfree_app_id || !config.cashfree_secret_key) {
      return jsonRes({ error: "Cashfree not configured for this store" }, 400);
    }

    const env = config.cashfree_env === "sandbox" ? "sandbox" : "production";
    const cfBase = env === "sandbox"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    // ord_ prefix prevents any chance of collision with SaaS billing's sub_ prefixed orders
    const cfOrderId = `ord_${order_id.slice(0, 8)}_${Date.now()}`;

    const phone = String(customer_phone || "").replace(/\D/g, "").slice(-10);
    const safePhone = phone.length === 10 ? phone : "9999999999";

    const cfPayload = {
      order_id: cfOrderId,
      order_amount: Number(chargeAmount.toFixed(2)),
      order_currency: currency.toUpperCase(),
      customer_details: {
        customer_id: order_id,
        customer_name: (customer_name || "Customer").slice(0, 100),
        customer_email: customer_email || "noreply@shopbanao.in",
        customer_phone: safePhone,
      },
      order_meta: {
        // Return URL is informational only; we use SDK callback + status polling
        return_url: `${req.headers.get("origin") || ""}/?cf_order={order_id}`,
      },
      order_tags: { store_order_id: order_id, store_id },
    };

    const cfRes = await fetch(`${cfBase}/orders`, {
      method: "POST",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": config.cashfree_app_id,
        "x-client-secret": config.cashfree_secret_key,
        "content-type": "application/json",
      },
      body: JSON.stringify(cfPayload),
    });

    const cfData = await cfRes.json();
    if (!cfRes.ok) {
      console.error("Cashfree create-order error", cfData);
      return jsonRes(
        { error: cfData.message || "Failed to create Cashfree order", details: cfData },
        502
      );
    }

    return jsonRes({
      cf_order_id: cfOrderId,
      payment_session_id: cfData.payment_session_id,
      env,
      amount: numAmount,
      currency: currency.toUpperCase(),
    });
  } catch (err) {
    console.error("store-cashfree-create-order error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
