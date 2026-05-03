// Cashfree webhook receiver. Handles BOTH:
//  1. SaaS billing payments (cf_order_id starts with "sub_") → updates subscription_payments
//  2. Per-store storefront orders (cf_order_id starts with "ord_") → updates orders
//
// Signature verification:
//  - SaaS billing uses platform CASHFREE_SECRET_KEY (env var)
//  - Per-store uses the merchant's own cashfree_secret_key from store_payment_config
//
// This is a public endpoint (verify_jwt = false) — security comes from HMAC verification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const PLATFORM_CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY")!;

function getAnchorDay(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const m = notes.match(/\[billing_anchor_day:(\d{1,2})\]/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  if (isNaN(d) || d < 1 || d > 28) return null;
  return d;
}

function nextAnchoredPeriodEnd(from: Date, anchorDay: number): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), anchorDay, 0, 0, 0));
  if (next.getTime() <= from.getTime()) {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

async function computeSig(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get("x-webhook-timestamp") || "";
    const receivedSig = req.headers.get("x-webhook-signature") || "";
    const data = `${timestamp}${rawBody}`;

    const event = JSON.parse(rawBody);
    const eventType = event.type;
    const cfOrderId: string | undefined = event?.data?.order?.order_id;

    if (!cfOrderId) {
      return new Response("OK (no order_id)", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---------- Branch 1: per-store storefront order (ord_ prefix) ----------
    if (cfOrderId.startsWith("ord_")) {
      // Recover store_id from order_tags (set by store-cashfree-create-order)
      const tags = event?.data?.order?.order_tags || {};
      const storeId: string | undefined = tags.store_id;
      const localOrderId: string | undefined = tags.store_order_id;

      if (!storeId || !localOrderId) {
        console.warn("Storefront webhook missing tags", { cfOrderId, tags });
        return new Response("OK (missing tags)", { status: 200 });
      }

      // Fetch merchant's cashfree secret to verify signature
      const { data: config } = await supabase
        .from("store_payment_config")
        .select("cashfree_secret_key")
        .eq("store_id", storeId)
        .single();

      if (!config?.cashfree_secret_key) {
        console.warn("No cashfree secret for store", storeId);
        return new Response("OK (no merchant secret)", { status: 200 });
      }

      const computedSig = await computeSig(config.cashfree_secret_key, data);
      if (computedSig !== receivedSig) {
        console.warn("Storefront webhook signature mismatch", { cfOrderId, storeId });
        return new Response("Invalid signature", { status: 401 });
      }

      // Idempotency — fetch order
      const { data: orderRow } = await supabase
        .from("orders")
        .select("status, payment_type")
        .eq("id", localOrderId)
        .single();

      if (!orderRow) return new Response("OK (unknown order)", { status: 200 });

      if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
        if (orderRow.status === "confirmed" || orderRow.status === "partially_paid") {
          return new Response("OK (already paid)", { status: 200 });
        }
        const isPartial = orderRow.payment_type === "partial";
        await supabase
          .from("orders")
          .update({
            status: isPartial ? "partially_paid" : "confirmed",
            payment_method: "cashfree",
            notes: `Cashfree Order ID: ${cfOrderId}`,
          })
          .eq("id", localOrderId);
      } else if (eventType === "PAYMENT_FAILED_WEBHOOK" || eventType === "PAYMENT_USER_DROPPED_WEBHOOK") {
        // Don't overwrite a confirmed order — only mark fresh failures
        if (orderRow.status === "pending") {
          await supabase
            .from("orders")
            .update({ status: "cancelled" })
            .eq("id", localOrderId)
            .eq("status", "pending");
        }
      }

      return new Response("OK", { status: 200 });
    }

    // ---------- Branch 2: SaaS billing (sub_ prefix or unknown) ----------
    // Verify with platform secret
    const platformSig = await computeSig(PLATFORM_CASHFREE_SECRET_KEY, data);
    if (platformSig !== receivedSig) {
      console.warn("SaaS webhook signature mismatch");
      return new Response("Invalid signature", { status: 401 });
    }

    const { data: payment } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("cashfree_order_id", cfOrderId)
      .single();

    if (!payment) {
      return new Response("OK (unknown order)", { status: 200 });
    }

    if (payment.status === "paid" && eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      return new Response("OK (already paid)", { status: 200 });
    }

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      const paymentInfo = event?.data?.payment || {};
      const periodStart = new Date();
      const defaultPeriodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { data: assignment } = await supabase
        .from("store_plan_assignments")
        .select("*")
        .eq("store_id", payment.store_id)
        .single();

      const anchorDay = getAnchorDay(assignment?.notes);
      const periodEnd = anchorDay
        ? nextAnchoredPeriodEnd(periodStart, anchorDay)
        : defaultPeriodEnd;

      await supabase
        .from("subscription_payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          cashfree_payment_id: paymentInfo.cf_payment_id ? String(paymentInfo.cf_payment_id) : null,
          payment_method: paymentInfo.payment_group || null,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          raw_payload: event,
        })
        .eq("id", payment.id)
        .neq("status", "paid");

      if (assignment) {
        const updates: any = {
          last_payment_at: new Date().toISOString(),
          grace_period_ends_at: null,
          next_billing_amount: null,
        };
        if (assignment.is_one_time) {
          updates.billing_status = "one_time_paid";
        } else {
          updates.billing_status = "active";
          updates.current_period_end = periodEnd.toISOString();
        }
        await supabase
          .from("store_plan_assignments")
          .update(updates)
          .eq("store_id", payment.store_id);
      }

      await supabase.from("stores")
        .update({ is_suspended: false, suspension_reason: null })
        .eq("id", payment.store_id)
        .eq("suspension_reason", "billing");
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK") {
      await supabase
        .from("subscription_payments")
        .update({
          status: "failed",
          failure_reason: event?.data?.payment?.payment_message || "Payment failed",
          raw_payload: event,
        })
        .eq("id", payment.id)
        .neq("status", "paid");
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("webhook error", err);
    return new Response("Error", { status: 500 });
  }
});
