// Cashfree webhook for wallet recharges. Public endpoint — verifies HMAC with platform secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const PLATFORM_SECRET = Deno.env.get("CASHFREE_SECRET_KEY")!;

async function computeSig(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get("x-webhook-timestamp") || "";
    const receivedSig = req.headers.get("x-webhook-signature") || "";
    const data = `${timestamp}${rawBody}`;

    const expected = await computeSig(PLATFORM_SECRET, data);
    if (expected !== receivedSig) return new Response("Invalid signature", { status: 401 });

    const event = JSON.parse(rawBody);
    const cfOrderId: string | undefined = event?.data?.order?.order_id;
    const eventType: string | undefined = event?.type;
    if (!cfOrderId || !cfOrderId.startsWith("wallet_")) {
      return new Response("OK (not wallet)", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Log event — but DO NOT bail on duplicate. wallet_apply_recharge is
    // idempotent (guards on status='pending'), and bailing on a duplicate
    // event_id would permanently strand a recharge if the first delivery
    // crashed after this insert but before applying the credit.
    const eventId =
      String(event?.event_id ?? event?.data?.event_id ?? "") ||
      `${eventType}:${cfOrderId}:${event?.data?.payment?.cf_payment_id ?? ""}`;
    await supabase
      .from("webhook_events")
      .insert({ provider: "cashfree", event_id: eventId, payload: event });

    const { data: rec, error: recErr } = await supabase
      .from("store_wallet_recharges")
      .select("*")
      .eq("cashfree_order_id", cfOrderId)
      .single();
    if (recErr || !rec) {
      console.error("wallet webhook: recharge lookup failed", { cfOrderId, recErr });
      return new Response("OK (unknown)", { status: 200 });
    }

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      const payInfo = event?.data?.payment || {};
      if (rec.status !== "paid") {
        const { error: upErr } = await supabase
          .from("store_wallet_recharges")
          .update({
            cashfree_payment_id: payInfo.cf_payment_id ? String(payInfo.cf_payment_id) : null,
            payment_method: payInfo.payment_group || null,
            raw_payload: event,
          })
          .eq("id", rec.id)
          .is("cashfree_payment_id", null);
        if (upErr) console.error("wallet webhook: pre-apply update failed", upErr);

        const { error: rpcErr } = await supabase.rpc("wallet_apply_recharge", { _recharge_id: rec.id });
        if (rpcErr) {
          // Return 500 so Cashfree retries
          console.error("wallet webhook: wallet_apply_recharge failed", rpcErr);
          return new Response("apply failed", { status: 500 });
        }
      }
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK" || eventType === "PAYMENT_USER_DROPPED_WEBHOOK") {
      await supabase
        .from("store_wallet_recharges")
        .update({
          status: "failed",
          failure_reason: event?.data?.payment?.payment_message || "Payment failed",
          raw_payload: event,
        })
        .eq("id", rec.id)
        .eq("status", "pending");
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("wallet webhook error", e);
    return new Response("Error", { status: 500 });
  }
});
