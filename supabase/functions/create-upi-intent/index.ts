// Universal UPI Intent creator — picks the store's active PG (Cashfree > Razorpay > PayU)
// and returns a `upi://` deeplink the browser fires to open GPay/PhonePe/Paytm directly.
//
// Used by the CheckoutV2 tile UI. Dormant until UI calls it — safe to deploy alongside
// the existing checkout flow.
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

    // Pick PG in order: cashfree > razorpay > payu (Cashfree has the cleanest UPI intent API)
    const pg: "cashfree" | "razorpay" | "payu" | null =
      methods.includes("cashfree") && config.cashfree_app_id && config.cashfree_secret_key ? "cashfree" :
      methods.includes("razorpay") && config.razorpay_key_id && config.razorpay_key_secret ? "razorpay" :
      methods.includes("payu") && config.payu_merchant_key && config.payu_merchant_salt ? "payu" :
      null;

    if (!pg) return jsonRes({ error: "No UPI-capable gateway configured" }, 400);

    const safePhone = String(customer_phone || "").replace(/\D/g, "").slice(-10) || "9999999999";
    const safeEmail = (customer_email && String(customer_email).trim()) || "noreply@shopbanao.in";
    const safeName = (customer_name || "Customer").toString().trim().slice(0, 60) || "Customer";

    // ─── Cashfree UPI Intent ──────────────────────────────────────────────
    if (pg === "cashfree") {
      const env = config.cashfree_env === "sandbox" ? "sandbox" : "production";
      const cfBase = env === "sandbox" ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

      // Create the order first (Cashfree requires an order before sessions)
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
        console.error("cashfree create-order failed", cfOrder);
        return jsonRes({ error: cfOrder.message || "Cashfree order create failed" }, 502);
      }

      // Now call the pay endpoint with UPI channel=link (or collect for VPA)
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
        console.error("cashfree sessions failed", cfPay);
        return jsonRes({ error: cfPay.message || "Cashfree UPI intent failed", details: cfPay }, 502);
      }

      // Cashfree returns intent URL in `data.url` for link channel
      const intentUrl =
        cfPay?.data?.url ||
        cfPay?.data?.payload?.default ||
        cfPay?.data?.payload?.gpay ||
        cfPay?.data?.payload?.phonepe ||
        cfPay?.data?.payload?.paytm;

      return jsonRes({
        pg: "cashfree",
        env,
        intent_url: intentUrl || null,
        payload: cfPay?.data?.payload || null,
        cf_order_id: cfOrderId,
        payment_session_id: cfOrder.payment_session_id,
        amount: chargeAmount,
        currency,
        channel: vpa ? "collect" : "link",
      });
    }

    // ─── Razorpay UPI Intent ──────────────────────────────────────────────
    if (pg === "razorpay") {
      const authHeader = "Basic " + btoa(`${config.razorpay_key_id}:${config.razorpay_key_secret}`);
      const amountInPaise = Math.round(chargeAmount * 100);

      // Create RZP order
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
        console.error("razorpay order failed", rzpOrder);
        return jsonRes({ error: "Razorpay order failed", details: rzpOrder }, 502);
      }

      // Create UPI payment (intent or collect)
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
        console.error("razorpay upi intent failed", payData);
        return jsonRes({ error: payData.error?.description || "Razorpay UPI intent failed" }, 502);
      }

      return jsonRes({
        pg: "razorpay",
        env: "production",
        intent_url: payData.data?.intent_url || payData.intent_url || null,
        razorpay_payment_id: payData.razorpay_payment_id,
        razorpay_order_id: rzpOrder.id,
        amount: chargeAmount,
        currency,
        channel: vpa ? "collect" : "link",
      });
    }

    // ─── PayU S2S UPI (Bank codes: TEZ=GPay, PHONEPE, PAYTM, UPI=any) ─────
    // PayU S2S is complex; for v1 we return a signal to the UI to fall back to Bolt SDK.
    // Full PayU UPI intent can be added in a later stage.
    if (pg === "payu") {
      return jsonRes({
        pg: "payu",
        fallback: true,
        message: "PayU tile UPI intent not yet implemented — use Bolt SDK",
      }, 200);
    }

    return jsonRes({ error: "Unsupported gateway" }, 400);
  } catch (err) {
    console.error("create-upi-intent error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
