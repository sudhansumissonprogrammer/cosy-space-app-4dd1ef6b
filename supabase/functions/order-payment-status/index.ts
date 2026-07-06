// Unified payment status poller for CheckoutV2 tiles.
// Called every 2s while the user is on the "waiting for GPay..." screen.
// Returns { status: "pending" | "success" | "failed", order_status } based on
// the orders row (webhooks/verify calls have already updated it).
//
// This is intentionally a lightweight read — it does NOT call the PG's status API
// directly (that would 20x their API traffic during polling). PG webhooks + the
// existing verify functions keep the DB fresh.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { mapPayuStatus, verifyPayuTxn, type PayuEnv } from "../_shared/payuHelpers.ts";

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

function txnidForPayuOrder(orderId: string): string {
  return `sb_${String(orderId).replace(/-/g, "").slice(0, 16)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { store_id, order_id } = await req.json();
    if (!store_id || !order_id) return jsonRes({ error: "Missing required fields" }, 400);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || !uuidRegex.test(order_id)) {
      return jsonRes({ error: "Invalid ID format" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, store_id, status, payment_verified, payment_method, payment_type, checkout_token")
      .eq("id", order_id)
      .maybeSingle();

    if (error || !order) return jsonRes({ error: "Order not found" }, 404);
    if (order.store_id !== store_id) return jsonRes({ error: "Order/store mismatch" }, 403);

    // PayU safety net: CheckoutV2 can lose in-memory gateway refs when mobile
    // UPI/PayU returns in a fresh tab. The PayU txnid is deterministic for V2,
    // so verify directly here before reporting "pending" forever.
    if (order.status === "pending") {
      const { data: cfg } = await supabase
        .from("store_payment_config")
        .select("payment_methods, payu_merchant_key, payu_merchant_salt, payu_env")
        .eq("store_id", store_id)
        .maybeSingle();

      const methods = Array.isArray(cfg?.payment_methods) ? cfg.payment_methods : [];
      if (methods.includes("payu") && cfg?.payu_merchant_key && cfg?.payu_merchant_salt) {
        const txnid = txnidForPayuOrder(order_id);
        const env = (cfg.payu_env === "sandbox" ? "sandbox" : "production") as PayuEnv;
        const det = await verifyPayuTxn({ env, key: cfg.payu_merchant_key, salt: cfg.payu_merchant_salt, txnid });
        if (det && mapPayuStatus(det.status) === "PAID") {
          const newStatus = order.payment_type === "partial" ? "partially_paid" : "confirmed";
          await supabase
            .from("orders")
            .update({
              status: newStatus,
              payment_method: "payu",
              notes: `PayU Txn ID: ${txnid}${det.mihpayid ? ` (mihpayid: ${det.mihpayid})` : ""}`,
              payment_verified: true,
              payment_verified_at: new Date().toISOString(),
            })
            .eq("id", order_id)
            .eq("store_id", store_id)
            .eq("status", "pending");
          if (order.checkout_token) {
            await supabase
              .from("abandoned_carts")
              .update({ recovered: true })
              .eq("store_id", store_id)
              .eq("session_token", order.checkout_token);
          }
          await firePurchaseCapi(supabase, order_id, { source: "order-payment-status-payu" });
          order.status = newStatus;
          order.payment_method = "payu";
          order.payment_verified = true;
        }
      }
    }

    let payment_status: "pending" | "success" | "failed" = "pending";
    if (order.status === "confirmed" || order.status === "partially_paid" || order.status === "paid") {
      payment_status = "success";
    } else if (order.status === "cancelled" || order.status === "failed") {
      payment_status = "failed";
    }

    return jsonRes({
      payment_status,
      order_status: order.status,
      payment_verified: order.payment_verified,
      payment_method: order.payment_method,
    });
  } catch (err) {
    console.error("order-payment-status error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
