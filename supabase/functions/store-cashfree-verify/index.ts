// Verifies a per-store Cashfree payment by querying Cashfree with the merchant's OWN creds.
// Updates orders.status to "confirmed" or "partially_paid" only if Cashfree reports PAID.
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
    const { store_id, order_id, cf_order_id } = await req.json();
    if (!store_id || !order_id || !cf_order_id) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get order to determine partial vs full
    const { data: orderInfo } = await supabase
      .from("orders")
      .select("payment_type, status")
      .eq("id", order_id)
      .single();
    const isPartial = orderInfo?.payment_type === "partial";

    // If already confirmed, short-circuit (idempotent)
    if (orderInfo?.status === "confirmed" || orderInfo?.status === "partially_paid") {
      return jsonRes({ success: true, status: "PAID", already_confirmed: true });
    }

    const { data: config, error: configErr } = await supabase
      .from("store_payment_config")
      .select("cashfree_app_id, cashfree_secret_key, cashfree_env")
      .eq("store_id", store_id)
      .single();

    if (configErr || !config?.cashfree_secret_key) {
      return jsonRes({ error: "Payment config not found" }, 404);
    }

    const cfBase = config.cashfree_env === "sandbox"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    const cfRes = await fetch(`${cfBase}/orders/${encodeURIComponent(cf_order_id)}`, {
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": config.cashfree_app_id || "",
        "x-client-secret": config.cashfree_secret_key,
      },
    });

    if (!cfRes.ok) {
      const txt = await cfRes.text();
      console.error("Cashfree fetch order failed", txt);
      return jsonRes({ error: "Failed to verify with Cashfree" }, 502);
    }

    const cfOrder = await cfRes.json();
    const status: string = cfOrder.order_status; // ACTIVE, PAID, EXPIRED, TERMINATED, TERMINATION_REQUESTED

    if (status === "PAID") {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          status: isPartial ? "partially_paid" : "confirmed",
          payment_method: "cashfree",
          notes: `Cashfree Order ID: ${cf_order_id}`,
          payment_verified: true,
          payment_verified_at: new Date().toISOString(),
        })
        .eq("id", order_id);
      if (updateErr) {
        console.error("Order update error", updateErr);
        return jsonRes({ error: "Failed to update order" }, 500);
      }
      return jsonRes({ success: true, status: "PAID" });
    }

    return jsonRes({ success: false, status });
  } catch (err) {
    console.error("store-cashfree-verify error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
