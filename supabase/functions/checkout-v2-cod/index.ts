// Finalize a CheckoutV2 pending order as COD.
//
// CheckoutV2 pre-creates the order as `status=pending, payment_method=razorpay`
// (placeholder) so UPI intents can be generated in parallel. If the shopper
// picks Cash-on-Delivery instead, this endpoint flips that order to
// `status=confirmed, payment_method=cod` server-side (RLS blocks storefront
// customers from UPDATEing orders directly).
//
// Safe: only mutates orders that are still `pending` AND belong to the given
// store, and only if the store actually has COD enabled in payment_methods.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";

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

function firePurchaseCapiInBackground(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  source: string,
) {
  const task = firePurchaseCapi(supabase, orderId, { source }).catch((err) => {
    console.warn("checkout-v2-cod CAPI background error", err);
  });
  // Keep tracking alive after returning the shopper-facing response. CAPI can
  // retry upstream for several seconds and must not hold the COD confirmation.
  // @ts-ignore — EdgeRuntime is provided by the edge-function Deno runtime.
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore — EdgeRuntime is provided by the edge-function Deno runtime.
    EdgeRuntime.waitUntil(task);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

  try {
    const { store_id, order_id } = await req.json();
    if (!store_id || !order_id) return jsonRes({ error: "Missing required fields" }, 400);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || !uuidRegex.test(order_id)) {
      return jsonRes({ error: "Invalid ID format" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify store allows standalone COD. A partial-payment store may still
    // list `cod` because the remaining balance is collected on delivery, but
    // that must never create a zero-advance full-COD order.
    const [{ data: config }, { data: store }] = await Promise.all([
      supabase
        .from("store_payment_config")
        .select("payment_methods")
        .eq("store_id", store_id)
        .single(),
      supabase
        .from("stores")
        .select("partial_payment_enabled, partial_payment_value")
        .eq("id", store_id)
        .single(),
    ]);

    const methods = Array.isArray(config?.payment_methods) ? (config!.payment_methods as string[]) : [];
    const hasOnline = ["razorpay", "cashfree", "payu"].some((m) => methods.includes(m));
    // A store with no online gateway can only ever take COD — allow it even if
    // `cod` was never explicitly listed, otherwise checkout dead-ends.
    if (!methods.includes("cod") && hasOnline) {
      return jsonRes({ error: "COD not enabled for this store" }, 400);
    }
    // Advance-payment stores must collect the advance online — but only if an
    // online gateway actually exists to collect it.
    if (hasOnline && store?.partial_payment_enabled && Number(store.partial_payment_value || 0) > 0) {
      return jsonRes({ error: "Advance payment is required for this store" }, 400);
    }

    // Fetch the order and validate ownership + pending state
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, store_id, status, payment_type, total, notes")
      .eq("id", order_id)
      .maybeSingle();
    if (fetchErr || !order) return jsonRes({ error: "Order not found" }, 404);
    if (order.store_id !== store_id) return jsonRes({ error: "Order/store mismatch" }, 403);

    // Already-processed guard (idempotent). If the order was created directly
    // as COD in place-order, that path already fired Purchase CAPI. If it was
    // flipped by a prior checkout-v2-cod call, the firePurchaseCapi stamp
    // (meta_purchase_fired_at) makes the retry a no-op.
    if (order.status === "confirmed" || order.status === "partially_paid" || order.status === "paid") {
      // Safety re-fire: no-op if already stamped. Covers race where the initial
      // flip succeeded but the CAPI call was interrupted.
      firePurchaseCapiInBackground(supabase, order_id, "checkout-v2-cod-idempotent");
      return jsonRes({ ok: true, already: true, order_id });
    }
    if (order.status !== "pending") {
      return jsonRes({ error: `Cannot convert order in status=${order.status}` }, 409);
    }

    // For partial-payment orders, COD "top up" doesn't apply — reject.
    if (order.payment_type === "partial") {
      return jsonRes({ error: "Partial-payment orders cannot be finalized as COD" }, 400);
    }

    // Roll back the prepaid discount (if any). place-order stamps it on the
    // order when the shopper originally intended to pay online, but COD
    // orders MUST NOT get that discount — otherwise the customer is charged
    // ₹100 less on delivery than the store expects.
    const rawNotes: string = String((order as any).notes || "");
    const prepaidMatch = rawNotes.match(/^\s*Prepaid discount:\s*-?(\d+(?:\.\d+)?)\s*$/im);
    const restoreAmount = prepaidMatch ? Number(prepaidMatch[1]) : 0;
    const newTotal = Number((order as any).total || 0) + (restoreAmount > 0 ? restoreAmount : 0);
    const newNotes = prepaidMatch
      ? rawNotes.replace(prepaidMatch[0], "").replace(/\n{2,}/g, "\n").trim() || null
      : (rawNotes || null);

    const { error: updErr } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        payment_method: "cod",
        payment_type: "full",
        total: newTotal,
        notes: newNotes,
      })
      .eq("id", order_id)
      .eq("store_id", store_id)
      .eq("status", "pending"); // race guard
    if (updErr) return jsonRes({ error: updErr.message }, 500);

    // CRITICAL: fire Meta Purchase CAPI now. place-order skipped it because
    // the order was originally inserted as `payment_method="razorpay"` (the
    // UPI placeholder). Without this, browser Pixel Purchase fires with no
    // server-side dedup partner and Meta Event Match Quality tanks for the
    // "UPI-then-switched-to-COD" segment of orders.
    firePurchaseCapiInBackground(supabase, order_id, "checkout-v2-cod");

    return jsonRes({ ok: true, order_id });
  } catch (err) {
    console.error("checkout-v2-cod error", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
