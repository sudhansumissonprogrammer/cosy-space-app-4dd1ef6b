import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { UTKAL_STORE_ID } from "../_shared/utkalContent.ts";
import { canUsePlatformCashfree, matchesPlatformPayment, PLATFORM_CASHFREE_PATH } from "../_shared/utkalPlatformCashfreePolicy.ts";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { fireWaOrderEvent } from "../_shared/wa-fire-order-event.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
});
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
  .map(v => v.toString(16).padStart(2, "0")).join("");
const randomCapability = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v => v.toString(16).padStart(2, "0")).join("");
const validId = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

async function signatureValid(raw: string, timestamp: string, signature: string, secret: string) {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const time = Number(timestamp);
  const millis = time < 1e12 ? time * 1000 : time;
  if (Math.abs(Date.now() - millis) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  try {
    const bytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    return await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(timestamp + raw));
  } catch { return false; }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) return json({ error: "Payment service unavailable" }, 503);
    const admin = createClient(url, service);
    const raw = await req.text();
    if (raw.length > 65536) return json({ error: "Request too large" }, 413);
    let body: any;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request" }, 400); }
    const webhook = new URL(req.url).searchParams.get("webhook") === "1";
    const { data: settings, error: settingsError } = await admin.from("utkal_platform_payment_settings").select("enabled,environment").eq("store_id", UTKAL_STORE_ID).maybeSingle();
    if (settingsError) return json({ error: "Payment service unavailable" }, 503);
    // No configuration row, false, or the wrong store can never collect money.
    if (!webhook && !canUsePlatformCashfree(body.store_id ?? UTKAL_STORE_ID, settings?.enabled === true)) return json({ error: "This payment feature is disabled", code: "disabled" }, 403);

    if (body.action === "handoff" && !webhook) {
      if (body.store_id !== UTKAL_STORE_ID || !validId(body.order_id) || typeof body.checkout_token !== "string" || body.checkout_token.length < 8 || body.checkout_token.length > 256) return json({ error: "Invalid checkout" }, 400);
      const token = randomCapability();
      const { error } = await admin.rpc("reserve_utkal_platform_payment", { p_order_id: body.order_id, p_checkout_token: body.checkout_token, p_token_hash: await digest(token) });
      if (error) return json({ error: "Checkout cannot start. Resolve any previous payment before retrying." }, 409);
      return json({ token });
    }

    let attempt: any;
    if (webhook) {
      const id = body?.data?.order?.order_id;
      if (typeof id !== "string" || !id.startsWith("utkal_")) return json({ error: "Invalid payment reference" }, 400);
      const result = await admin.from("utkal_platform_payment_attempts").select("*").eq("provider_order_id", id).maybeSingle();
      if (result.error || !result.data) return json({ error: "Unknown payment" }, 404);
      attempt = result.data;
    } else {
      if (!["session", "verify"].includes(body.action) || typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) return json({ error: "Invalid payment link" }, 400);
      const result = await admin.from("utkal_platform_payment_attempts").select("*").eq("token_hash", await digest(body.token)).maybeSingle();
      if (result.error || !result.data || Date.parse(result.data.expires_at) < Date.now()) return json({ error: "Payment link expired or invalid" }, 403);
      attempt = result.data;
    }
    if (attempt.store_id !== UTKAL_STORE_ID) return json({ error: "Invalid store" }, 403);
    const appId = Deno.env.get("CASHFREE_APP_ID");
    const secret = Deno.env.get("CASHFREE_SECRET_KEY");
    if (!appId || !secret) return json({ error: "Payment gateway unavailable" }, 503);
    if (webhook && !await signatureValid(raw, req.headers.get("x-webhook-timestamp") || "", req.headers.get("x-webhook-signature") || "", secret)) return json({ error: "Invalid signature" }, 401);
    const base = attempt.environment === "sandbox" ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
    const headers = { "x-client-id": appId, "x-client-secret": secret, "x-api-version": "2023-08-01", "Content-Type": "application/json" };
    const cf = async (path: string, options: RequestInit = {}) => {
      const response = await fetch(base + path, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error("Cashfree request unavailable");
      return response.json();
    };

    const verify = async () => {
      if (attempt.state === "paid") return { paid: true };
      const payment = await cf(`/orders/${encodeURIComponent(attempt.provider_order_id)}`);
      if (payment.order_status !== "PAID") return { paid: false, status: payment.order_status };
      if (!matchesPlatformPayment(attempt, payment)) return { paid: false, review: true };
      const payments = await cf(`/orders/${encodeURIComponent(attempt.provider_order_id)}/payments`);
      const successful = Array.isArray(payments) ? payments.find(p => p.payment_status === "SUCCESS" && Math.round(Number(p.payment_amount) * 100) === Number(attempt.amount_minor) && p.payment_currency === attempt.currency) : undefined;
      if (!successful?.cf_payment_id) return { paid: false, review: true };
      const result = await admin.rpc("finalize_utkal_platform_payment", { p_attempt_id: attempt.id, p_payment_id: String(successful.cf_payment_id) });
      if (result.error) throw new Error("Payment confirmation unavailable");
      if (result.data?.paid) {
        await firePurchaseCapi(admin, attempt.order_id, { source: "utkal-platform-cashfree" });
        await fireWaOrderEvent(admin, attempt.order_id);
      }
      return result.data;
    };

    if (webhook) return json(await verify());
    const summary = { order_id: attempt.order_id, amount: Number(attempt.amount_minor) / 100, total: Number(attempt.total_minor) / 100, balance: (Number(attempt.total_minor) - Number(attempt.amount_minor)) / 100, payment_type: attempt.payment_type };
    if (body.action === "verify") return json({ ...summary, ...await verify(), return_url: "https://utkalwatch.in/checkout" });
    if (attempt.state === "paid") return json({ ...summary, paid: true });
    if (attempt.state === "review") return json({ error: "Payment needs review. Do not pay again." }, 409);
    const { data: order, error: orderError } = await admin.from("orders").select("id,status,total,advance_paid,payment_type,currency,customer_name,customer_phone,customer_email").eq("id", attempt.order_id).eq("store_id", UTKAL_STORE_ID).single();
    if (orderError || !order || order.status !== "pending" || Math.round(Number(order.total) * 100) !== Number(attempt.total_minor) || order.payment_type !== attempt.payment_type || (order.payment_type === "partial" && Math.round(Number(order.advance_paid) * 100) !== Number(attempt.amount_minor))) return json({ error: "Order changed. Return to checkout." }, 409);
    if (!attempt.payment_session_id) {
      const phone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(phone)) return json({ error: "Invalid customer phone" }, 400);
      const payment = await cf("/orders", {
        method: "POST", headers: { "x-idempotency-key": attempt.id },
        body: JSON.stringify({ order_id: attempt.provider_order_id, order_amount: summary.amount, order_currency: "INR", customer_details: { customer_id: attempt.order_id, customer_phone: phone, customer_name: order.customer_name, ...(order.customer_email ? { customer_email: order.customer_email } : {}) }, order_tags: { store_order_id: attempt.order_id, store_id: UTKAL_STORE_ID }, order_meta: { return_url: `https://shopbanao.in${PLATFORM_CASHFREE_PATH}?returned=1`, notify_url: `${url}/functions/v1/utkal-platform-cashfree?webhook=1` } }),
      });
      if (!payment.payment_session_id) return json({ error: "Payment session unavailable" }, 502);
      const saved = await admin.from("utkal_platform_payment_attempts").update({ payment_session_id: payment.payment_session_id, state: "ready" }).eq("id", attempt.id).eq("state", "reserved").select("payment_session_id").maybeSingle();
      if (saved.error) return json({ error: "Could not save payment session. Retry safely." }, 503);
      attempt.payment_session_id = payment.payment_session_id;
    }
    return json({ ...summary, payment_session_id: attempt.payment_session_id, environment: attempt.environment });
  } catch { return json({ error: "Payment could not be confirmed. Please retry the status check." }, 503); }
});