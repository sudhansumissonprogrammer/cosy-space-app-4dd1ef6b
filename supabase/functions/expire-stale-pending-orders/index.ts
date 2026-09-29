// Marks pending checkout orders older than 30 min as `expired`.
//
// Why: when a shopper starts a payment (order row inserted with status=pending)
// and never completes it — closed tab, killed UPI app, gave up — the row sits
// forever in pending, cluttering dashboards, skewing conversion metrics, and
// keeping the checkout_token "in use" so the same shopper can't retry cleanly.
//
// Safety: only flips rows still in `pending` (RLS-style guard on the update)
// AND older than 30 min AND not payment_verified. A late webhook can still
// win — it updates by (id, status=pending) which will no-op after this cron
// promotes the row to `expired`, so no double state transitions.
//
// Scheduled via pg_cron every 10 minutes.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Ask the gateway FIRST. A shopper can pay on the very last UPI attempt and
  // have the browser die before returning; if we cancel before reconciling,
  // the merchant sees "auto-expired" on an order that was actually paid.
  // payu-reconcile is idempotent and only upgrades orders PayU reports as paid.
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/payu-reconcile`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
  } catch (e) {
    console.error("expire-stale-pending-orders: reconcile pre-pass failed", e);
  }

  // NOTE: `orders_status_check` does not permit 'expired'. We mark the row
  // 'cancelled' and record the reason in notes so dashboards + the recovery
  // cron still treat it as a payment drop-off (cancelled + payment_verified=false).

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      notes: "Auto-expired: no payment received within 30 min",
    })
    .eq("status", "pending")
    .eq("payment_verified", false)
    // PayU orders have their own gateway-verified reconciler. If PayU is slow,
    // this generic expiry must not mark a still-settling advance as cancelled.
    .or("payment_method.is.null,payment_method.neq.payu")
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    console.error("expire-stale-pending-orders error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const count = data?.length ?? 0;
  console.log(`expire-stale-pending-orders: expired ${count} orders older than ${cutoff}`);
  return new Response(JSON.stringify({ expired: count, cutoff }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
