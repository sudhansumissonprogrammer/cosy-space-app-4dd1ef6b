// PayU webhook receiver — server-to-server callback PayU sends regardless of
// whether the browser returns to the storefront. This is the safety net that
// keeps orders accurate when the customer pays via UPI collect and never reopens
// the tab, or loses signal during redirect.
//
// Security: reverse-hash verification with the merchant's OWN salt. No public
// endpoint should ever trust the body alone.
//
// Idempotent: dedup'd via webhook_events table on (provider, event_id).
//
// Public endpoint — must be declared with verify_jwt = false in config.toml.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { computePayuReverseHash, mapPayuStatus } from "../_shared/payuHelpers.ts";
import { timingSafeEqual } from "../_shared/security.ts";
import { fireWaOrderEvent } from "../_shared/wa-fire-order-event.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

// PayU may POST as application/x-www-form-urlencoded OR application/json
async function readBody(req: Request): Promise<Record<string, string>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    const raw = await req.json().catch(() => ({}));
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw || {})) out[k] = v == null ? "" : String(v);
    return out;
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await readBody(req);

    const txnid = body.txnid;
    const status = body.status;
    const key = body.key;
    const amount = body.amount;
    const productinfo = body.productinfo;
    const firstname = body.firstname;
    const email = body.email;
    const receivedHash = body.hash;
    const mihpayid = body.mihpayid || "";
    const additionalCharges = body.additionalCharges || "";

    // Recover our local ids from udf fields (set in payu-create-txn)
    const localOrderId = body.udf1;
    const storeId = body.udf2;

    if (!txnid || !status || !key || !receivedHash || !localOrderId || !storeId) {
      console.warn("payu-webhook missing fields", { txnid, status, hasKey: !!key, hasHash: !!receivedHash });
      return new Response("OK (missing fields)", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up merchant salt to verify hash
    const { data: config } = await supabase
      .from("store_payment_config")
      .select("payu_merchant_salt, payu_merchant_key")
      .eq("store_id", storeId)
      .single();

    if (!config?.payu_merchant_salt) {
      console.warn("No payu salt for store", storeId);
      return new Response("OK (no merchant secret)", { status: 200 });
    }

    // Verify reverse hash
    const computed = await computePayuReverseHash({
      salt: config.payu_merchant_salt,
      status,
      udf1: body.udf1 || "",
      udf2: body.udf2 || "",
      udf3: body.udf3 || "",
      udf4: body.udf4 || "",
      udf5: body.udf5 || "",
      email: email || "",
      firstname: firstname || "",
      productinfo: productinfo || "",
      amount: amount || "",
      txnid,
      key,
      additionalCharges: additionalCharges || undefined,
    });

    if (!timingSafeEqual(computed.toLowerCase(), String(receivedHash).toLowerCase())) {
      console.warn("payu-webhook signature mismatch", { txnid, storeId });
      return new Response("Invalid signature", { status: 401 });
    }

    // Idempotency via webhook_events — scope event_id by storeId so two stores
    // can never collide on a shared txnid.
    const eventId = `payu:${storeId}:${txnid}:${status}:${mihpayid || amount}`;
    const { error: dupErr } = await supabase
      .from("webhook_events")
      .insert({ provider: "payu", event_id: eventId, payload: body });
    if (dupErr) {
      const msg = String(dupErr.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return new Response("OK (duplicate)", { status: 200 });
      }
      console.warn("webhook_events insert failed", dupErr.message);
    }

    const verdict = mapPayuStatus(status);

    const { data: orderRow } = await supabase
      .from("orders")
      .select("status, payment_type, customer_phone, storefront_customer_id")
      .eq("id", localOrderId)
      .eq("store_id", storeId)
      .single();
    if (!orderRow) return new Response("OK (unknown order)", { status: 200 });

    if (verdict === "PAID") {
      if (orderRow.status === "confirmed" || orderRow.status === "partially_paid") {
        if (!orderRow.storefront_customer_id) {
          const customerId = await findCustomerByPhone(supabase, storeId, orderRow.customer_phone);
          if (customerId) await supabase.from("orders").update({ storefront_customer_id: customerId }).eq("id", localOrderId).eq("store_id", storeId);
        }
        // Already marked — still try CAPI in case the previous attempt failed (idempotent).
        await firePurchaseCapi(supabase, localOrderId, { source: "payu-webhook" });
        // Safety net: fire WhatsApp order_confirmation. wa-order-event is
        // idempotent-guarded downstream by wa_send_queue dedupe on order_id+template.
        await fireWaOrderEvent(supabase, localOrderId, "order_confirmation");
        return new Response("OK (already paid)", { status: 200 });
      }
      const isPartial = orderRow.payment_type === "partial";
      const customerId = !orderRow.storefront_customer_id
        ? await findCustomerByPhone(supabase, storeId, orderRow.customer_phone)
        : null;
      const update: Record<string, unknown> = {
        status: isPartial ? "partially_paid" : "confirmed",
        payment_method: "payu",
        notes: `PayU Txn ID: ${txnid}${mihpayid ? ` (mihpayid: ${mihpayid})` : ""}`,
        payment_verified: true,
        payment_verified_at: new Date().toISOString(),
      };
      if (customerId) update.storefront_customer_id = customerId;
      await supabase
        .from("orders")
        .update(update)
        .eq("id", localOrderId)
        .eq("store_id", storeId);
      await firePurchaseCapi(supabase, localOrderId, { source: "payu-webhook" });
      await fireWaOrderEvent(supabase, localOrderId, "order_confirmation");
    }
    // FAILED: do NOT cancel here. This callback describes ONE attempt; an
    // earlier/later attempt on the same order may be captured. payu-reconcile
    // checks every attempt and only cancels when none is paid or pending.

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("payu-webhook error", err);
    return new Response("Error", { status: 500 });
  }
});
