// Cashfree webhook receiver. Verifies signature & marks payments paid.
// Public endpoint (verify_jwt = false).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY")!;

// Parses an anchor day (1-28) from assignment.notes via tag like [billing_anchor_day:5]
function getAnchorDay(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const m = notes.match(/\[billing_anchor_day:(\d{1,2})\]/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  if (isNaN(d) || d < 1 || d > 28) return null;
  return d;
}

// Returns the next occurrence of `anchorDay` strictly after `from` (UTC).
function nextAnchoredPeriodEnd(from: Date, anchorDay: number): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), anchorDay, 0, 0, 0));
  if (next.getTime() <= from.getTime()) {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get("x-webhook-timestamp") || "";
    const receivedSig = req.headers.get("x-webhook-signature") || "";

    // Verify signature: base64(HMAC-SHA256(timestamp + rawBody, secret))
    const data = `${timestamp}${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(CASHFREE_SECRET_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    const computedSig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    if (computedSig !== receivedSig) {
      console.warn("Webhook signature mismatch");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;
    const orderId = event?.data?.order?.order_id;

    if (!orderId) {
      return new Response("OK (no order_id)", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("cashfree_order_id", orderId)
      .single();

    if (!payment) {
      return new Response("OK (unknown order)", { status: 200 });
    }

    // Idempotency: skip if already paid
    if (payment.status === "paid" && eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      return new Response("OK (already paid)", { status: 200 });
    }

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      const paymentInfo = event?.data?.payment || {};
      const periodStart = new Date();
      const defaultPeriodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Fetch assignment first to honor billing anchor day
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

      // Unsuspend only if it was a billing suspension (don't override admin bans)
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
