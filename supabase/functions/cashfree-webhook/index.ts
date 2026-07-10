// Safety-net Cashfree webhook for STORE orders (both classic + checkout-v2 flow).
//
// Cashfree POSTs here on payment events. We do NOT trust the payload contents
// — instead we use the cf_order_id as a "wake up" trigger and re-query Cashfree
// with the merchant's own credentials (single source of truth). This makes the
// endpoint safe to call even without HMAC verification because the actual order
// state comes from a signed API call to Cashfree using the merchant's key.
//
// Purpose: if the shopper's browser dies mid-payment (very common on mobile
// UPI intent flow), the store-cashfree-verify call from the client never fires
// and the order stays in "pending" forever. This webhook is the safety net —
// Cashfree calls it independently, we confirm the order server-side.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { fireWaOrderEvent } from "../_shared/wa-fire-order-event.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const raw = await req.text();
    let event: any;
    try { event = JSON.parse(raw); } catch { return new Response("Bad payload", { status: 400 }); }

    const cfOrderId: string | undefined = event?.data?.order?.order_id;
    const eventType: string | undefined = event?.type;
    if (!cfOrderId) return new Response("OK (no cf order id)", { status: 200 });

    // Skip wallet/subscription orders — handled by their own webhooks
    if (cfOrderId.startsWith("wallet_") || cfOrderId.startsWith("sub_")) {
      return new Response("OK (not store order)", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency guard
    const eventId =
      String(event?.event_id ?? event?.data?.event_id ?? "") ||
      `${eventType}:${cfOrderId}:${event?.data?.payment?.cf_payment_id ?? ""}`;
    const { error: dupErr } = await supabase
      .from("webhook_events")
      .insert({ provider: "cashfree_store", event_id: eventId, payload: event });
    if (dupErr && (dupErr as any).code === "23505") {
      // Already processed — but STILL proceed because the earlier processing
      // may have crashed. Idempotent update logic below handles double-run.
      console.log("cashfree-webhook duplicate event", eventId);
    }

    // Recover store_id + order_id from order_tags (we set these in create-order
    // and create-upi-intent). Fallback: parse the classic ord_<8>_<ts> / v2_<8>_<ts>
    // prefix + look up by store_id/order prefix.
    const tags = event?.data?.order?.order_tags || {};
    let orderId: string | null = tags.store_order_id || null;
    let storeId: string | null = tags.store_id || null;

    if (!orderId || !storeId) {
      // Fallback lookup — find order by cf_order_id prefix in notes
      const prefix = cfOrderId.split("_")[1]; // 8 chars of order UUID
      if (prefix) {
        const { data: rows } = await supabase
          .from("orders")
          .select("id, store_id")
          .ilike("id", `${prefix}%`)
          .limit(1);
        if (rows && rows[0]) {
          orderId = rows[0].id;
          storeId = rows[0].store_id;
        }
      }
    }

    if (!orderId || !storeId) {
      console.warn("cashfree-webhook: could not resolve order for", cfOrderId);
      return new Response("OK (unknown order)", { status: 200 });
    }

    // Get the store's credentials to verify with Cashfree API (source of truth)
    const { data: config } = await supabase
      .from("store_payment_config")
      .select("cashfree_app_id, cashfree_secret_key, cashfree_env")
      .eq("store_id", storeId)
      .single();

    if (!config?.cashfree_secret_key) {
      console.warn("cashfree-webhook: no cashfree config for store", storeId);
      return new Response("OK (no config)", { status: 200 });
    }

    const cfBase = config.cashfree_env === "sandbox"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    const cfRes = await fetch(`${cfBase}/orders/${encodeURIComponent(cfOrderId)}`, {
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": config.cashfree_app_id || "",
        "x-client-secret": config.cashfree_secret_key,
      },
    });
    if (!cfRes.ok) {
      const txt = await cfRes.text();
      console.error("cashfree-webhook: cf verify failed", txt);
      return new Response("Verify failed", { status: 500 });
    }
    const cfOrder = await cfRes.json();
    const status: string = cfOrder.order_status;

    if (status === "PAID") {
      const { data: orderInfo } = await supabase
        .from("orders")
        .select("payment_type, status, checkout_token, total, advance_paid")
        .eq("id", orderId)
        .eq("store_id", storeId)
        .single();

      if (!orderInfo) return new Response("OK (no order)", { status: 200 });

      if (orderInfo.status === "confirmed" || orderInfo.status === "partially_paid" || orderInfo.status === "paid") {
        return new Response("OK (already paid)", { status: 200 });
      }

      // Amount-mismatch guard — reject payments that don't match expected charge.
      const expectedAmount = orderInfo.payment_type === "partial" && Number(orderInfo.advance_paid) > 0
        ? Number(orderInfo.advance_paid)
        : Number(orderInfo.total);
      const paidAmount = Number(cfOrder.order_amount || 0);
      if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        console.error("cashfree-webhook: amount mismatch", {
          orderId, expectedAmount, paidAmount, cfOrderId,
        });
        return new Response("OK (amount mismatch — manual review)", { status: 200 });
      }

      const isPartial = orderInfo.payment_type === "partial";
      await supabase
        .from("orders")
        .update({
          status: isPartial ? "partially_paid" : "confirmed",
          payment_method: "cashfree",
          notes: `Cashfree Order ID: ${cfOrderId} (webhook)`,
          payment_verified: true,
          payment_verified_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("store_id", storeId)
        .eq("status", "pending");


      if (orderInfo.checkout_token) {
        await supabase
          .from("abandoned_carts")
          .update({ recovered: true })
          .eq("store_id", storeId)
          .eq("session_token", orderInfo.checkout_token);
      }
      await firePurchaseCapi(supabase, orderId, { source: "cashfree-webhook" });
      await fireWaOrderEvent(supabase, orderId, "order_confirmation");
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("cashfree-webhook error", e);
    return new Response("Error", { status: 500 });
  }
});
