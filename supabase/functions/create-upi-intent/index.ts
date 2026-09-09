// Universal UPI Intent creator — picks the store's active PG (Cashfree > Razorpay > PayU)
// and returns a `upi://` deeplink the browser fires to open GPay/PhonePe/Paytm directly.
//
// Used by the CheckoutV2 tile UI. Dormant until UI calls it — safe to deploy alongside
// the existing checkout flow.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPayuProductInfo, computePayuRequestHash, mapPayuStatus, payuCheckoutHost, verifyPayuTxn, withUpiNote, type PayuEnv } from "../_shared/payuHelpers.ts";

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
      return_url,
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
      .select("id, store_id, total, status, payment_type, advance_paid, order_number, currency, notes, payu_txnids")
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

    // Store name is shown to the shopper inside the UPI app (transaction note).
    const { data: storeRow } = await supabase
      .from("stores")
      .select("name")
      .eq("id", store_id)
      .maybeSingle();
    const storeName = (storeRow as any)?.name || "";
    const isPartial = dbOrder.payment_type === "partial" && Number(dbOrder.advance_paid) > 0;

    const methods = Array.isArray(config.payment_methods) ? (config.payment_methods as string[]) : [];

    // STRICT GATEWAY: use ONLY the store's selected/primary gateway. No silent
    // fallback to another PG — a PayU-only store must never touch Razorpay or
    // Cashfree, and orders must never get labelled with a gateway that isn't
    // enabled for that store.
    const gatewayChain: ("cashfree" | "razorpay" | "payu")[] = [];
    if (methods.includes("cashfree") && config.cashfree_app_id && config.cashfree_secret_key) gatewayChain.push("cashfree");
    else if (methods.includes("razorpay") && config.razorpay_key_id && config.razorpay_key_secret) gatewayChain.push("razorpay");
    else if (methods.includes("payu") && config.payu_merchant_key && config.payu_merchant_salt) gatewayChain.push("payu");

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

          // Cashfree UPI channels:
          //   • "link"    → server returns intent deeplinks in data.payload.*  (no upi_id)
          //   • "collect" → server pushes a request to the given VPA           (upi_id = vpa)
          // Sending `upi_id: "gpay"` with channel "link" is a BUG — Cashfree
          // treats upi_id as a VPA and rejects/ignores the request. To open a
          // specific app we pick the matching key from data.payload instead.
          const upiPayload: Record<string, unknown> = vpa
            ? { channel: "collect", upi_id: vpa }
            : { channel: "link" };

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

          // App-specific first, then default. Cashfree may nest payload one or
          // two levels deep depending on api-version, so probe both shapes.
          const payload = cfPay?.data?.payload || cfPay?.payload || {};
          const appKey = CF_APP_MAP[upiApp]; // gpay / phonepe / paytm / undefined
          const intentUrl: string | undefined =
            (appKey && (payload as any)[appKey]) ||
            (payload as any).default ||
            (payload as any).web ||
            (payload as any).gpay ||
            (payload as any).phonepe ||
            (payload as any).paytm ||
            cfPay?.data?.url;

          if (!intentUrl) {
            lastError = { pg: "cashfree", message: "Cashfree returned no intent URL", details: cfPay };
            continue;
          }

          await supabase
            .from("orders")
            .update({
              payment_method: "cashfree",
              notes: [dbOrder.notes, `Cashfree Order ID: ${cfOrderId}`].filter(Boolean).join("\n"),
            })
            .eq("id", order_id)
            .eq("store_id", store_id)
            .eq("status", "pending");

          return jsonRes({
            pg: "cashfree",
            env,
            intent_url: intentUrl,
            payload,
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

          // Persist gateway refs so webhooks / status checks can resolve this order.
          await supabase
            .from("orders")
            .update({ razorpay_order_id: rzpOrder.id, payment_method: "razorpay" })
            .eq("id", order_id)
            .eq("store_id", store_id)
            .eq("status", "pending");

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

          // Modern Razorpay S2S UPI Intent returns
          //   { razorpay_payment_id, type: "intent", next: [{ action: "invoke", url: "upi://..." }] }
          // Older/enterprise variants use  data.intent_url  or  intent_url.
          // Some accounts return the raw intent under  data.next[0].url.
          const nextArr: any[] = payData?.next || payData?.data?.next || [];
          const nextInvoke = nextArr.find((n) => n?.action === "invoke" || String(n?.url || "").startsWith("upi://"));
          const rawIntent: string | undefined =
            nextInvoke?.url ||
            payData?.data?.intent_url ||
            payData?.intent_url ||
            payData?.data?.upi?.intent_url;

          let intentUrl: string | undefined;
          if (rawIntent) {
            intentUrl = rawIntent.startsWith("upi://") ? rawIntent : `upi://pay?${rawIntent.replace(/^\?/, "")}`;
          }

          if (!intentUrl || !intentUrl.startsWith("upi://")) {
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
          // txnid MUST be unique per *attempt*. place-order reuses one pending
          // order row across retries, so a deterministic `sb_<order16>` made
          // attempt #2 collide with a txnid PayU had already seen (EX108) —
          // the intent never minted, the UI never entered its polling state,
          // and a shopper who DID pay on attempt #1 came back to a stuck
          // "processing" screen. Mirror payu-create-txn: first attempt keeps
          // the legacy id, later attempts get a short unique suffix, and every
          // txnid is persisted so status/reconcile can verify all of them.
          const baseTxnid = `sb_${order_id.replace(/-/g, "").slice(0, 16)}`;
          const priorTxnids: string[] = Array.isArray((dbOrder as any).payu_txnids)
            ? ((dbOrder as any).payu_txnids as string[])
            : [];
          const txnid = priorTxnids.length === 0
            ? baseTxnid
            : `${baseTxnid}x${Date.now().toString(36).slice(-4)}`;
          if (!priorTxnids.includes(txnid)) {
            await supabase
              .from("orders")
              .update({ payu_txnids: [...priorTxnids, txnid].slice(-8) })
              .eq("id", order_id)
              .eq("store_id", store_id);
            (dbOrder as any).payu_txnids = [...priorTxnids, txnid].slice(-8);
          }
          const amountStr = chargeAmount.toFixed(2);
          // Shown inside GPay/PhonePe/Paytm as the transaction note:
          //   "Serdiya Jewellers - Advance Rs 100 - Order 6348"
          const productinfo = buildPayuProductInfo({
            storeName,
            orderNumber: dbOrder.order_number || order_id.slice(0, 8),
            amount: chargeAmount,
            isPartial,
          });
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const notifyUrl = `${supabaseUrl}/functions/v1/payu-webhook`;
          const originHdr = req.headers.get("origin") || "";
          let returnBase = originHdr || "";
          try {
            const candidate = return_url ? new URL(String(return_url)) : null;
            const origin = originHdr ? new URL(originHdr) : null;
            if (candidate && origin && candidate.origin === origin.origin) returnBase = candidate.toString();
          } catch { /* keep origin fallback */ }
          const withPayuParams = (base: string, status: "success" | "failure") => {
            const u = new URL(base || originHdr || "https://shopbanao.in/checkout");
            u.searchParams.set("payu_status", status);
            u.searchParams.set("txnid", txnid);
            u.searchParams.set("payu_order", order_id);
            return u.toString();
          };
          const surl = returnBase ? withPayuParams(returnBase, "success") : notifyUrl;
          const furl = returnBase ? withPayuParams(returnBase, "failure") : notifyUrl;

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

          // PayU returns the intent in `result.intentURIData` as a bare query
          // string (e.g. `pa=...&pn=...&am=...`). Some variants return a full
          // `upi://pay?...` URL under `data` or `metaData.upiIntentUri`.
          const rawIntent: string | undefined =
            payuData?.result?.intentURIData ||
            payuData?.data ||
            payuData?.upi_intent_url ||
            payuData?.metaData?.upiIntentUri ||
            payuData?.metaData?.intentURIData ||
            (typeof payuData?.result === "string" && payuData.result.startsWith("upi://") ? payuData.result : undefined);

          let intentUrl: string | undefined;
          if (rawIntent) {
            intentUrl = rawIntent.startsWith("upi://") ? rawIntent : `upi://pay?${rawIntent}`;
            // Some PayU accounts send a bare "Payment" note — replace it with
            // our store/advance wording when the URI carries no signature.
            intentUrl = withUpiNote(intentUrl, productinfo);
          }

          if (!intentUrl || !intentUrl.startsWith("upi://")) {
            // Before giving up: PayU rejects a duplicate txnid (EX108) when a
            // previous attempt on this order was already captured. Ask PayU
            // about every txnid this order ever used — if one is PAID we must
            // confirm the order right here instead of dropping the shopper on
            // a dead "processing" screen.
            const allTxnids = Array.from(
              new Set([...(Array.isArray((dbOrder as any).payu_txnids) ? (dbOrder as any).payu_txnids as string[] : []), baseTxnid]),
            );
            for (const t of allTxnids) {
              try {
                const det = await verifyPayuTxn({
                  env,
                  key: config.payu_merchant_key!,
                  salt: config.payu_merchant_salt!,
                  txnid: t,
                });
                if (det && mapPayuStatus(det.status) === "PAID") {
                  await supabase
                    .from("orders")
                    .update({
                      status: dbOrder.payment_type === "partial" ? "partially_paid" : "confirmed",
                      payment_method: "payu",
                      payment_verified: true,
                      payment_verified_at: new Date().toISOString(),
                      notes: `PayU Txn ID: ${t}${det.mihpayid ? ` (mihpayid: ${det.mihpayid})` : ""}`,
                    })
                    .eq("id", order_id)
                    .eq("store_id", store_id)
                    .eq("status", "pending");
                  return jsonRes({ available: false, already_paid: true, code: "order_already_paid", order_id }, 409);
                }
              } catch { /* keep checking */ }
            }
            lastError = {
              pg: "payu",
              message: payuData?.error_Message || payuData?.message || "PayU returned no intent URL",
              details: payuData,
            };
            continue;
          }


          // Webhook resolves the order via udf1/udf2 — no extra order column needed.

          await supabase
            .from("orders")
            .update({ payment_method: "payu" })
            .eq("id", order_id)
            .eq("store_id", store_id)
            .eq("status", "pending");



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

    // All gateways failed. Return 200 (not 502) so this stops flooding
    // error-log dashboards — it's a merchant-config situation (no S2S-approved
    // gateway on this store), not a server crash. Client checks `available`
    // to hide the UPI-app tile gracefully.
    console.warn("create-upi-intent: no UPI-intent-capable gateway", lastError);
    return jsonRes({
      available: false,
      error: lastError?.message || "No gateway could generate a UPI intent",
      code: lastError?.code || "no_upi_gateway",
      pg_tried: gatewayChain,
      last_pg: lastError?.pg,
    }, 200);

  } catch (err) {
    console.error("create-upi-intent error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
