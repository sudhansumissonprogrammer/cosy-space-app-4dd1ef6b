// Universal UPI Intent creator — picks the store's active PG (Cashfree > Razorpay > PayU)
// and returns a `upi://` deeplink the browser fires to open GPay/PhonePe/Paytm directly.
//
// Used by the CheckoutV2 tile UI. Dormant until UI calls it — safe to deploy alongside
// the existing checkout flow.
import { createClient } from "npm:@supabase/supabase-js@2";
import { computePayuRequestHash, payuCheckoutHost, type PayuEnv } from "../_shared/payuHelpers.ts";

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

type UpiApp = "gpay" | "phonepe" | "paytm" | "any";

// Cashfree app tokens (per their docs)
const CF_APP_MAP: Record<UpiApp, string | undefined> = {
  gpay: "gpay",
  phonepe: "phonepe",
  paytm: "paytm",
  any: undefined,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      store_id,
      order_id,
      app = "any",
      vpa,
      customer_name,
      customer_phone,
      customer_email,
    } = body || {};

    if (!store_id || !order_id) return jsonRes({ error: "Missing required fields" }, 400);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || !uuidRegex.test(order_id)) {
      return jsonRes({ error: "Invalid ID format" }, 400);
    }

    const upiApp: UpiApp = (["gpay", "phonepe", "paytm", "any"].includes(app) ? app : "any") as UpiApp;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load canonical order + amount
    const { data: dbOrder, error: orderErr } = await supabase
      .from("orders")
      .select("id, store_id, total, status, payment_type, advance_paid, order_number, currency")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !dbOrder) return jsonRes({ error: "Order not found" }, 404);
    if (dbOrder.store_id !== store_id) return jsonRes({ error: "Order/store mismatch" }, 403);
    if (dbOrder.status === "confirmed" || dbOrder.status === "partially_paid" || dbOrder.status === "paid") {
      return jsonRes({ error: "Order already paid" }, 409);
    }

    const chargeAmount = dbOrder.payment_type === "partial" && Number(dbOrder.advance_paid) > 0
      ? Number(dbOrder.advance_paid)
      : Number(dbOrder.total);
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      return jsonRes({ error: "Invalid order total" }, 400);
    }

    const currency = (dbOrder.currency || "INR").toUpperCase();

    // Load store payment config
    const { data: config, error: configErr } = await supabase
      .from("store_payment_config")
      .select("cashfree_app_id, cashfree_secret_key, cashfree_env, razorpay_key_id, razorpay_key_secret, payu_merchant_key, payu_merchant_salt, payu_env, payment_methods")
      .eq("store_id", store_id)
      .single();
    if (configErr || !config) return jsonRes({ error: "Payment config not found" }, 404);

    const methods = Array.isArray(config.payment_methods) ? (config.payment_methods as string[]) : [];

    // Build an ordered fallback list of gateways to try (Cashfree S2S requires
    // approval; when not approved we transparently fall back to Razorpay).
    const gatewayChain: ("cashfree" | "razorpay" | "payu")[] = [];
    if (methods.includes("cashfree") && config.cashfree_app_id && config.cashfree_secret_key) gatewayChain.push("cashfree");
    if (methods.includes("razorpay") && config.razorpay_key_id && config.razorpay_key_secret) gatewayChain.push("razorpay");
    if (methods.includes("payu") && config.payu_merchant_key && config.payu_merchant_salt) gatewayChain.push("payu");

    if (gatewayChain.length === 0) {
      return jsonRes({ error: "No UPI-capable gateway configured", code: "no_gateway" }, 400);
    }

    const safePhone = String(customer_phone || "").replace(/\D/g, "").slice(-10) || "9999999999";
    const safeEmail = (customer_email && String(customer_email).trim()) || "noreply@shopbanao.in";
    const safeName = (customer_name || "Customer").toString().trim().slice(0, 60) || "Customer";

    // Attempt each gateway in the fallback chain. If Cashfree returns
    // s2s_enabled_not_approved (merchant doesn't have server-to-server API
    // enabled), we transparently try the next configured gateway. Only
    // return the last error to the client if ALL gateways fail.
    let lastError: { pg: string; message: string; code?: string; details?: unknown } | null = null;

    for (const pg of gatewayChain) {
      // ─── Cashfree UPI Intent ────────────────────────────────────────────
      if (pg === "cashfree") {
        try {
          const env = config.cashfree_env === "sandbox" ? "sandbox" : "production";
          const cfBase = env === "sandbox" ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

          const cfOrderId = `v2_${order_id.slice(0, 8)}_${Date.now()}`;
          const cfOrderRes = await fetch(`${cfBase}/orders`, {
            method: "POST",
            headers: {
              "x-api-version": "2023-08-01",
              "x-client-id": config.cashfree_app_id!,
              "x-client-secret": config.cashfree_secret_key!,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              order_id: cfOrderId,
              order_amount: Number(chargeAmount.toFixed(2)),
              order_currency: currency,
              customer_details: {
                customer_id: order_id,
                customer_name: safeName,
                customer_email: safeEmail,
                customer_phone: safePhone,
              },
              order_tags: { store_order_id: order_id, store_id, flow: "checkout_v2" },
            }),
          });
          const cfOrder = await cfOrderRes.json();
          if (!cfOrderRes.ok || !cfOrder.payment_session_id) {
            lastError = { pg: "cashfree", message: cfOrder.message || "Cashfree order create failed", code: cfOrder.code, details: cfOrder };
            continue;
          }

          const upiPayload: Record<string, unknown> = vpa
            ? { channel: "collect", upi_id: vpa }
            : { channel: "link", ...(CF_APP_MAP[upiApp] ? { upi_id: CF_APP_MAP[upiApp] } : {}) };

          const cfPayRes = await fetch(`${cfBase}/orders/sessions`, {
            method: "POST",
            headers: {
              "x-api-version": "2023-08-01",
              "x-client-id": config.cashfree_app_id!,
              "x-client-secret": config.cashfree_secret_key!,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              payment_session_id: cfOrder.payment_session_id,
              payment_method: { upi: upiPayload },
            }),
          });
          const cfPay = await cfPayRes.json();
          if (!cfPayRes.ok) {
            // s2s_enabled_not_approved → account cannot use /orders/sessions. Fall back silently.
            console.warn("cashfree sessions failed — trying next gateway", cfPay?.code);
            lastError = { pg: "cashfree", message: cfPay.message || "Cashfree UPI intent failed", code: cfPay.code, details: cfPay };
            continue;
          }

          const intentUrl =
            cfPay?.data?.url ||
            cfPay?.data?.payload?.default ||
            cfPay?.data?.payload?.gpay ||
            cfPay?.data?.payload?.phonepe ||
            cfPay?.data?.payload?.paytm;

          if (!intentUrl) {
            lastError = { pg: "cashfree", message: "Cashfree returned no intent URL", details: cfPay };
            continue;
          }

          return jsonRes({
            pg: "cashfree",
            env,
            intent_url: intentUrl,
            payload: cfPay?.data?.payload || null,
            cf_order_id: cfOrderId,
            payment_session_id: cfOrder.payment_session_id,
            amount: chargeAmount,
            currency,
            channel: vpa ? "collect" : "link",
          });
        } catch (e: any) {
          lastError = { pg: "cashfree", message: e?.message || "Cashfree threw" };
          continue;
        }
      }

      // ─── Razorpay UPI Intent ────────────────────────────────────────────
      if (pg === "razorpay") {
        try {
          const authHeader = "Basic " + btoa(`${config.razorpay_key_id}:${config.razorpay_key_secret}`);
          const amountInPaise = Math.round(chargeAmount * 100);

          const rzpOrderRes = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
            body: JSON.stringify({
              amount: amountInPaise,
              currency,
              receipt: order_id,
              notes: { order_id, store_id, flow: "checkout_v2" },
            }),
          });
          const rzpOrder = await rzpOrderRes.json();
          if (!rzpOrderRes.ok) {
            lastError = { pg: "razorpay", message: rzpOrder?.error?.description || "Razorpay order failed", details: rzpOrder };
            continue;
          }

          // Persist razorpay_order_id so the razorpay-webhook safety-net can resolve this order
          await supabase.from("orders").update({ razorpay_order_id: rzpOrder.id }).eq("id", order_id).eq("store_id", store_id);

          const upiParams: Record<string, string> = {
            amount: String(amountInPaise),
            currency,
            order_id: rzpOrder.id,
            email: safeEmail,
            contact: safePhone,
            method: "upi",
            description: `Order ${dbOrder.order_number || order_id.slice(0, 8)}`,
          };
          if (vpa) {
            upiParams["upi[flow]"] = "collect";
            upiParams["upi[vpa]"] = vpa;
          } else {
            upiParams["upi[flow]"] = "intent";
          }

          const payRes = await fetch("https://api.razorpay.com/v1/payments/create/upi", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: authHeader,
            },
            body: new URLSearchParams(upiParams).toString(),
          });
          const payData = await payRes.json();
          if (!payRes.ok || payData.error) {
            lastError = { pg: "razorpay", message: payData?.error?.description || "Razorpay UPI intent failed", details: payData };
            continue;
          }

          const intentUrl = payData.data?.intent_url || payData.intent_url;
          if (!intentUrl) {
            lastError = { pg: "razorpay", message: "Razorpay returned no intent URL", details: payData };
            continue;
          }

          return jsonRes({
            pg: "razorpay",
            env: "production",
            intent_url: intentUrl,
            razorpay_payment_id: payData.razorpay_payment_id,
            razorpay_order_id: rzpOrder.id,
            amount: chargeAmount,
            currency,
            channel: vpa ? "collect" : "link",
          });
        } catch (e: any) {
          lastError = { pg: "razorpay", message: e?.message || "Razorpay threw" };
          continue;
        }
      }

      if (pg === "payu") {
        try {
          const env = (config.payu_env === "sandbox" ? "sandbox" : "production") as PayuEnv;
          const txnid = `sb_${order_id.replace(/-/g, "").slice(0, 16)}`;
          const amountStr = chargeAmount.toFixed(2);
          const productinfo = `Order ${dbOrder.order_number || order_id.slice(0, 8)}`;
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const notifyUrl = `${supabaseUrl}/functions/v1/payu-webhook`;
          const originHdr = req.headers.get("origin") || "";
          const surl = originHdr ? `${originHdr}/?payu_status=success&txnid=${txnid}&payu_order=${order_id}` : notifyUrl;
          const furl = originHdr ? `${originHdr}/?payu_status=failure&txnid=${txnid}&payu_order=${order_id}` : notifyUrl;

          const hash = await computePayuRequestHash({
            key: config.payu_merchant_key!,
            txnid,
            amount: amountStr,
            productinfo,
            firstname: safeName,
            email: safeEmail,
            udf1: order_id,
            udf2: store_id,
            salt: config.payu_merchant_salt!,
          });

          // PayU S2S seamless UPI Intent (requires merchant account to be
          // approved for seamless S2S — if not, PayU returns an error and
          // we fall through so the UI can show its "use standard checkout" hint).
          const body = new URLSearchParams({
            key: config.payu_merchant_key!,
            txnid,
            amount: amountStr,
            productinfo,
            firstname: safeName,
            email: safeEmail,
            phone: safePhone,
            surl,
            furl,
            hash,
            pg: "UPI",
            bankcode: "INTENT",
            txn_s2s_flow: "4",
            s2s_client_ip: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0",
            s2s_device_info: "WEB",
            udf1: order_id,
            udf2: store_id,
            udf3: "",
            udf4: "",
            udf5: "",
          });

          const payuRes = await fetch(`${payuCheckoutHost(env)}/_payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json",
            },
            body: body.toString(),
          });
          const rawText = await payuRes.text();
          let payuData: any = null;
          try { payuData = JSON.parse(rawText); } catch { /* not JSON — hosted checkout HTML */ }

          if (!payuData) {
            lastError = { pg: "payu", message: "PayU S2S not enabled on this merchant account", code: "payu_seamless_not_enabled" };
            continue;
          }

          // Intent URL can appear under several keys depending on PayU response variant
          const intentUrl: string | undefined =
            payuData?.data ||
            payuData?.upi_intent_url ||
            payuData?.metaData?.upiIntentUri ||
            payuData?.metaData?.intentURIData ||
            (typeof payuData?.result === "string" && payuData.result.startsWith("upi://") ? payuData.result : undefined);

          if (!intentUrl || !String(intentUrl).startsWith("upi://")) {
            lastError = {
              pg: "payu",
              message: payuData?.error_Message || payuData?.message || "PayU returned no intent URL",
              details: payuData,
            };
            continue;
          }

          // Persist txnid so payu-webhook / payu-status can resolve later
          await supabase.from("orders").update({ payu_txnid: txnid }).eq("id", order_id).eq("store_id", store_id);

          return jsonRes({
            pg: "payu",
            env,
            intent_url: intentUrl,
            payu_txnid: txnid,
            amount: chargeAmount,
            currency,
            channel: "link",
          });
        } catch (e: any) {
          lastError = { pg: "payu", message: e?.message || "PayU threw" };
          continue;
        }
      }
    }

    // All gateways failed
    console.error("create-upi-intent: all gateways failed", lastError);
    return jsonRes({
      error: lastError?.message || "No gateway could generate a UPI intent",
      code: lastError?.code || "all_gateways_failed",
      pg_tried: gatewayChain,
      last_pg: lastError?.pg,
    }, 502);
  } catch (err) {
    console.error("create-upi-intent error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
