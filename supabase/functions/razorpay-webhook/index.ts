// Safety-net Razorpay webhook for STORE orders.
//
// Razorpay POSTs here on payment events. We verify HMAC-SHA256 with a shared
// platform-level webhook secret (RAZORPAY_WEBHOOK_SECRET env var — set the SAME
// value in every store's Razorpay dashboard webhook config, since Razorpay
// doesn't support per-account webhook secrets on the free plan).
//
// Purpose: same as cashfree-webhook — if the browser tab dies before
// razorpay-verify runs, this catches it. Uses the razorpay_order_id stored on
// the orders row (set by razorpay-order edge fn) to find the local order.
import { createClient } from "npm:@supabase/supabase-js@2";
import { timingSafeEqual } from "../_shared/security.ts";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { fireWaOrderEvent } from "../_shared/wa-fire-order-event.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.warn("razorpay-webhook: RAZORPAY_WEBHOOK_SECRET not set — dropping event");
    return new Response("Not configured", { status: 200 });
  }

  try {
    const raw = await req.text();
    const receivedSig = req.headers.get("x-razorpay-signature") || "";
    const expectedSig = await hmacSha256Hex(webhookSecret, raw);
    if (!timingSafeEqual(expectedSig, receivedSig)) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(raw);
    const eventType: string = event?.event || "";
    const payment = event?.payload?.payment?.entity || {};
    const razorpayOrderId: string | undefined = payment.order_id;
    if (!razorpayOrderId) return new Response("OK (no order_id)", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency
    const eventId = String(event?.id || `${eventType}:${razorpayOrderId}:${payment.id}`);
    const { error: dupErr } = await supabase
      .from("webhook_events")
      .insert({ provider: "razorpay_store", event_id: eventId, payload: event });
    if (dupErr && (dupErr as any).code === "23505") {
      console.log("razorpay-webhook duplicate", eventId);
    }

    // Find local order via razorpay_order_id
    const { data: order } = await supabase
      .from("orders")
      .select("id, store_id, status, payment_type, checkout_token, total, advance_paid")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (!order) {
      console.warn("razorpay-webhook: no local order for", razorpayOrderId);
      return new Response("OK (unknown)", { status: 200 });
    }

    if (order.status === "confirmed" || order.status === "partially_paid" || order.status === "paid") {
      return new Response("OK (already paid)", { status: 200 });
    }

    if (eventType === "payment.captured" || eventType === "order.paid") {
      // Amount-mismatch guard — reject webhook payloads that don't match the
      // expected charge. Razorpay reports `amount` in paise.
      const expectedAmount = order.payment_type === "partial" && Number(order.advance_paid) > 0
        ? Number(order.advance_paid)
        : Number(order.total);
      const expectedPaise = Math.round(expectedAmount * 100);
      const paidPaise = Number(payment.amount || 0);
      if (Math.abs(paidPaise - expectedPaise) > 1) {
        console.error("razorpay-webhook: amount mismatch", {
          orderId: order.id, expectedPaise, paidPaise, paymentId: payment.id,
        });
        return new Response("OK (amount mismatch — manual review)", { status: 200 });
      }

      const isPartial = order.payment_type === "partial";
      await supabase
        .from("orders")
        .update({
          status: isPartial ? "partially_paid" : "confirmed",
          payment_method: "razorpay",
          notes: `Razorpay payment_id: ${payment.id} (webhook)`,
          payment_verified: true,
          payment_verified_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("store_id", order.store_id)
        .eq("status", "pending");


      if (order.checkout_token) {
        await supabase
          .from("abandoned_carts")
          .update({ recovered: true })
          .eq("store_id", order.store_id)
          .eq("session_token", order.checkout_token);
      }
      await firePurchaseCapi(supabase, order.id, { source: "razorpay-webhook" });
      await fireWaOrderEvent(supabase, order.id, "order_confirmation");
    } else if (eventType === "payment.failed") {
      await supabase
        .from("orders")
        .update({ status: "cancelled", notes: `Razorpay failed: ${payment.error_description || "n/a"}` })
        .eq("id", order.id)
        .eq("store_id", order.store_id)
        .eq("status", "pending");
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("razorpay-webhook error", e);
    return new Response("Error", { status: 500 });
  }
});
