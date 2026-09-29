// Per-store PayU Merchant Hosted (Bolt) — creates the transaction payload + hash
// the browser passes to bolt.launch(). Keys never leave the server.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPayuProductInfo, computePayuRequestHash, payuCheckoutHost, type PayuEnv } from "../_shared/payuHelpers.ts";

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
    const { store_id, order_id, customer_name, customer_phone, customer_email, return_url } = await req.json();
    if (!store_id || !order_id) return jsonRes({ error: "Missing required fields" }, 400);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || !uuidRegex.test(order_id)) {
      return jsonRes({ error: "Invalid ID format" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load order — server is the source of truth for amount.
    const { data: dbOrder, error: orderErr } = await supabase
      .from("orders")
      .select("id, store_id, total, status, payment_type, advance_paid, order_number, payu_txnids, payment_verified")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !dbOrder) return jsonRes({ error: "Order not found" }, 404);

    if (dbOrder.store_id !== store_id) return jsonRes({ error: "Order/store mismatch" }, 403);
    if (
      dbOrder.status === "confirmed" ||
      dbOrder.status === "partially_paid" ||
      dbOrder.status === "paid" ||
      dbOrder.payment_verified === true
    ) {
      return jsonRes({ error: "Order already paid" }, 409);
    }

    const chargeAmount =
      dbOrder.payment_type === "partial" && Number(dbOrder.advance_paid) > 0
        ? Number(dbOrder.advance_paid)
        : Number(dbOrder.total);
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      return jsonRes({ error: "Invalid order total" }, 400);
    }

    // Read merchant's own PayU credentials
    const { data: config, error: configErr } = await supabase
      .from("store_payment_config")
      .select("payu_merchant_key, payu_merchant_salt, payu_env, payment_methods")
      .eq("store_id", store_id)
      .single();

    if (configErr || !config) return jsonRes({ error: "Payment config not found" }, 404);

    const methods = Array.isArray(config.payment_methods) ? config.payment_methods : [];
    if (!methods.includes("payu") || !config.payu_merchant_key || !config.payu_merchant_salt) {
      return jsonRes({ error: "PayU not configured for this store" }, 400);
    }

    const env = (config.payu_env === "sandbox" ? "sandbox" : "production") as PayuEnv;
    // Reserve under a row lock: concurrent Pay taps must never overwrite each
    // other's transaction ID. Never issue a PayU form if reservation fails.
    const { data: txnid, error: reserveError } = await supabase.rpc("reserve_payu_attempt", {
      _order_id: order_id,
      _store_id: store_id,
    });
    if (reserveError || !txnid) {
      console.error("PayU attempt reservation failed", reserveError);
      return jsonRes({ error: "Could not start payment; please check order status and retry" }, 409);
    }


    const amountStr = chargeAmount.toFixed(2);
    // Store name + advance wording is what the shopper reads in the UPI app.
    const { data: storeRow } = await supabase
      .from("stores")
      .select("name")
      .eq("id", store_id)
      .maybeSingle();
    const productinfo = buildPayuProductInfo({
      storeName: (storeRow as any)?.name || "",
      orderNumber: dbOrder.order_number || order_id.slice(0, 8),
      amount: chargeAmount,
      isPartial: dbOrder.payment_type === "partial" && Number(dbOrder.advance_paid) > 0,
    });
    const firstname = (customer_name || "Customer").trim().slice(0, 60) || "Customer";
    // PayU rejects empty email; fall back to a placeholder.
    const email = (customer_email && String(customer_email).trim()) || "noreply@shopbanao.in";
    const phone = String(customer_phone || "").replace(/\D/g, "").slice(-10) || "9999999999";

    // Use udf1/udf2 to carry our own ids for webhook recovery
    const udf1 = order_id;
    const udf2 = store_id;

    const hash = await computePayuRequestHash({
      key: config.payu_merchant_key,
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      salt: config.payu_merchant_salt,
    });

    // Webhook callback (server-side) — even if browser never returns, PayU calls this.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const notifyUrl = `${supabaseUrl}/functions/v1/payu-webhook`;
    // Prefer the explicit return_url passed by the storefront (includes /checkout path),
    // fall back to the request origin so refunds/UPI returns still land on a working page.
    let returnBase = "";
    try {
      const u = new URL(return_url || req.headers.get("origin") || "");
      // Strip any prior payu_* params to avoid recursion
      u.searchParams.delete("payu_status");
      u.searchParams.delete("txnid");
      u.searchParams.delete("payu_order");
      returnBase = u.toString();
    } catch {
      returnBase = req.headers.get("origin") || "";
    }
    const sep = returnBase.includes("?") ? "&" : "?";
    const surl = `${returnBase}${sep}payu_status=success&txnid=${txnid}&payu_order=${order_id}`;
    const furl = `${returnBase}${sep}payu_status=failure&txnid=${txnid}&payu_order=${order_id}`;

    return jsonRes({
      env,
      action: `${payuCheckoutHost(env)}/_payment`,
      key: config.payu_merchant_key,
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      email,
      phone,
      udf1,
      udf2,
      udf3: "",
      udf4: "",
      udf5: "",
      surl,
      furl,
      notify_url: notifyUrl,
      hash,
    });
  } catch (err) {
    console.error("payu-create-txn error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
