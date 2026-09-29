// Verifies a per-store PayU payment by querying PayU's verify_payment API
// with the merchant's OWN credentials. Updates orders.status only if PayU
// reports success. Fires Meta CAPI Purchase (idempotent).
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { verifyPayuAttempts, type PayuEnv } from "../_shared/payuHelpers.ts";
import { fireWaOrderEvent } from "../_shared/wa-fire-order-event.ts";

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
    if (!store_id || !order_id || !txnid) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: orderInfo } = await supabase
      .from("orders")
      .select("payment_type, status, customer_phone, storefront_customer_id, checkout_token, payu_txnids")
      .eq("id", order_id)
      .eq("store_id", store_id)
      .single();
    if (!orderInfo) return jsonRes({ error: "Order not found for store" }, 404);

    // Idempotent short-circuit
    if (orderInfo?.status === "confirmed" || orderInfo?.status === "partially_paid") {
      if (!orderInfo.storefront_customer_id) {
        const customerId = await findCustomerByPhone(supabase, store_id, orderInfo.customer_phone);
        if (customerId) await supabase.from("orders").update({ storefront_customer_id: customerId }).eq("id", order_id).eq("store_id", store_id);
      }
      await firePurchaseCapi(supabase, order_id, { source: "payu-verify" });
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
    // Each retry mints a new txnid (PayU rejects duplicates), so verify the
    // txnid this tab holds plus every other attempt recorded on the order.
    const candidates: string[] = Array.from(
      new Set([txnid, ...((Array.isArray(orderInfo.payu_txnids) ? orderInfo.payu_txnids : []) as string[])]),
    );
    const best = await verifyPayuAttempts({ env, key: config.payu_merchant_key, salt: config.payu_merchant_salt, txnids: candidates });
    if (!best) {
      // PayU has no record yet — treat as pending so the client keeps polling.
      return jsonRes({ success: false, status: "PENDING" });
    }

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
      const { error: updateErr } = await supabase
        .from("orders")
        .update(update)
        .eq("id", order_id)
        .eq("store_id", store_id);
      if (updateErr) {
        console.error("Order update error", updateErr);
        return jsonRes({ error: "Failed to update order" }, 500);
      }
      // Mark the linked abandoned cart as recovered (payment succeeded).
      // place-order intentionally leaves online-payment carts un-recovered so
      // failed payments can be re-targeted; the verify step owns the flip.
      if (orderInfo?.checkout_token) {
        await supabase
          .from("abandoned_carts")
          .update({ recovered: true })
          .eq("store_id", store_id)
          .eq("session_token", orderInfo.checkout_token);
      }
      // Await to make sure CAPI fires before edge runtime kills the isolate
      await firePurchaseCapi(supabase, order_id, { source: "payu-verify" });
      // Safety net: fire WhatsApp order_confirmation server-side. Browser may
      // never invoke notify-order (tab closed / redirect lost).
      await fireWaOrderEvent(supabase, order_id, "order_confirmation");
      return jsonRes({ success: true, status: "PAID" });
    }

    return jsonRes({ success: false, status: verdict });
  } catch (err) {
    console.error("payu-verify-payment error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
