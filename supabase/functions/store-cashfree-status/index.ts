// Lightweight status check used by:
// - tab-focus / visibility-change auto-recheck
// - explicit "Check status" / "I've paid" retry button
// - post-cancel recovery flow
// Returns the live Cashfree order status AND will confirm the order if PAID.
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
    if (!store_id || !order_id) return jsonRes({ error: "Missing fields" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: orderInfo } = await supabase
      .from("orders")
      .select("status, payment_type")
      .eq("id", order_id)
      .single();

    if (orderInfo?.status === "confirmed" || orderInfo?.status === "partially_paid") {
      return jsonRes({ status: "PAID", local: orderInfo.status });
    }

    if (!cf_order_id) {
      return jsonRes({ status: orderInfo?.status === "cancelled" ? "TERMINATED" : "PENDING" });
    }

    const { data: config } = await supabase
      .from("store_payment_config")
      .select("cashfree_app_id, cashfree_secret_key, cashfree_env")
      .eq("store_id", store_id)
      .single();

    if (!config?.cashfree_secret_key) return jsonRes({ status: "PENDING" });

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

    if (!cfRes.ok) return jsonRes({ status: "PENDING" });
    const cfOrder = await cfRes.json();
    const status: string = cfOrder.order_status;

    if (status === "PAID") {
      const isPartial = orderInfo?.payment_type === "partial";
      await supabase
        .from("orders")
        .update({
          status: isPartial ? "partially_paid" : "confirmed",
          payment_method: "cashfree",
          notes: `Cashfree Order ID: ${cf_order_id}`,
        })
        .eq("id", order_id);
    }

    return jsonRes({ status });
  } catch (err) {
    console.error("store-cashfree-status error", err);
    return jsonRes({ status: "PENDING" });
  }
});
