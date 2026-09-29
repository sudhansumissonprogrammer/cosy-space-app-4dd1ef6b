// Lightweight PayU status check used by:
//  - tab-focus / visibility-change auto-recheck
//  - explicit "Check status" / "I've paid" retry button
//  - sessionStorage recovery on tab reload after returning from UPI app
//
// Returns the normalized verdict AND confirms the order if PayU reports success.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { verifyPayuAttempts, type PayuEnv } from "../_shared/payuHelpers.ts";

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

async function findCustomerByPhone(supabase: any, storeId: string, phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const { data } = await supabase
    .from("storefront_customers")
    .select("id, phone")
    .eq("store_id", storeId);
  const match = (data || []).find((row: any) => {
    const rowDigits = String(row.phone || "").replace(/\D/g, "");
    return rowDigits.length >= 10 && (rowDigits.endsWith(digits) || digits.endsWith(rowDigits));
  });
  return match?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { store_id, order_id, txnid } = await req.json();
    if (!store_id || !order_id) return jsonRes({ error: "Missing fields" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: orderInfo } = await supabase
      .from("orders")
      .select("status, payment_type, customer_phone, storefront_customer_id, payu_txnids")
      .eq("id", order_id)
      .eq("store_id", store_id)
      .single();
    if (!orderInfo) return jsonRes({ error: "Order not found for store" }, 404);

    if (orderInfo?.status === "confirmed" || orderInfo?.status === "partially_paid") {
      if (!orderInfo.storefront_customer_id) {
        const customerId = await findCustomerByPhone(supabase, store_id, orderInfo.customer_phone);
        if (customerId) await supabase.from("orders").update({ storefront_customer_id: customerId }).eq("id", order_id).eq("store_id", store_id);
      }
      await firePurchaseCapi(supabase, order_id, { source: "payu-status" });
      return jsonRes({ status: "PAID", local: orderInfo.status });
    }

    if (!txnid) {
      return jsonRes({
        status: orderInfo?.status === "cancelled" ? "FAILED" : "PENDING",
      });
    }

    const { data: config } = await supabase
      .from("store_payment_config")
      .select("payu_merchant_key, payu_merchant_salt, payu_env")
      .eq("store_id", store_id)
      .single();

    if (!config?.payu_merchant_key || !config?.payu_merchant_salt) {
      return jsonRes({ status: "PENDING" });
    }

    const env = (config.payu_env === "sandbox" ? "sandbox" : "production") as PayuEnv;
    // The shopper may have paid on a *different* attempt than the txnid this
    // tab remembers (each retry mints a fresh txnid). Check the remembered one
    // first, then every attempt recorded on the order.
    const candidates: string[] = Array.from(
      new Set([txnid, ...((Array.isArray(orderInfo.payu_txnids) ? orderInfo.payu_txnids : []) as string[])]),
    );
    const best = await verifyPayuAttempts({ env, key: config.payu_merchant_key, salt: config.payu_merchant_salt, txnids: candidates });
    if (!best) return jsonRes({ status: "PENDING" });
    const { det, txnid: matchedTxnid, verdict } = best;

    if (verdict === "PAID") {
      const isPartial = orderInfo?.payment_type === "partial";
      const customerId = !orderInfo?.storefront_customer_id
        ? await findCustomerByPhone(supabase, store_id, orderInfo?.customer_phone)
        : null;
      const update: Record<string, unknown> = {
        status: isPartial ? "partially_paid" : "confirmed",
        payment_method: "payu",
        notes: `PayU Txn ID: ${matchedTxnid}${det.mihpayid ? ` (mihpayid: ${det.mihpayid})` : ""}`,
        payment_verified: true,
        payment_verified_at: new Date().toISOString(),
      };
      if (customerId) update.storefront_customer_id = customerId;
      await supabase
        .from("orders")
        .update(update)
        .eq("id", order_id)
        .eq("store_id", store_id);
      await firePurchaseCapi(supabase, order_id, { source: "payu-status" });
    }

    return jsonRes({ status: verdict });
  } catch (err) {
    console.error("payu-status error", err);
    return jsonRes({ status: "PENDING" });
  }
});
