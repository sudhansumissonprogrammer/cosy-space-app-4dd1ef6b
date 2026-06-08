// Verifies a per-store PayU payment by querying PayU's verify_payment API
// with the merchant's OWN credentials. Updates orders.status only if PayU
// reports success. Fires Meta CAPI Purchase (idempotent).
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { verifyPayuTxn, mapPayuStatus, type PayuEnv } from "../_shared/payuHelpers.ts";

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
    const { store_id, order_id, txnid } = await req.json();
    if (!store_id || !order_id || !txnid) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: orderInfo } = await supabase
      .from("orders")
      .select("payment_type, status")
      .eq("id", order_id)
      .single();

    // Idempotent short-circuit
    if (orderInfo?.status === "confirmed" || orderInfo?.status === "partially_paid") {
      void firePurchaseCapi(supabase, order_id, { source: "payu-verify" });
      return jsonRes({ success: true, status: "PAID", already_confirmed: true });
    }

    const { data: config, error: configErr } = await supabase
      .from("store_payment_config")
      .select("payu_merchant_key, payu_merchant_salt, payu_env")
      .eq("store_id", store_id)
      .single();

    if (configErr || !config?.payu_merchant_key || !config?.payu_merchant_salt) {
      return jsonRes({ error: "Payment config not found" }, 404);
    }

    const env = (config.payu_env === "sandbox" ? "sandbox" : "production") as PayuEnv;
    const det = await verifyPayuTxn({
      env,
      key: config.payu_merchant_key,
      salt: config.payu_merchant_salt,
      txnid,
    });

    if (!det) {
      // PayU has no record yet — treat as pending so the client keeps polling.
      return jsonRes({ success: false, status: "PENDING" });
    }

    const verdict = mapPayuStatus(det.status);
    if (verdict === "PAID") {
      const isPartial = orderInfo?.payment_type === "partial";
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          status: isPartial ? "partially_paid" : "confirmed",
          payment_method: "payu",
          notes: `PayU Txn ID: ${txnid}${det.mihpayid ? ` (mihpayid: ${det.mihpayid})` : ""}`,
          payment_verified: true,
          payment_verified_at: new Date().toISOString(),
        })
        .eq("id", order_id);
      if (updateErr) {
        console.error("Order update error", updateErr);
        return jsonRes({ error: "Failed to update order" }, 500);
      }
      // Await to make sure CAPI fires before edge runtime kills the isolate
      await firePurchaseCapi(supabase, order_id, { source: "payu-verify" });
      return jsonRes({ success: true, status: "PAID" });
    }

    return jsonRes({ success: false, status: verdict });
  } catch (err) {
    console.error("payu-verify-payment error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
