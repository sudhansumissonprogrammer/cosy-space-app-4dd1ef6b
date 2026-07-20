// Meta CAPI reconciliation cron — runs every 2 minutes.
//
// TWO JOBS
// --------
// 1. Fire deferred Purchases: orders where `meta_purchase_deferred_until`
//    has elapsed but `meta_purchase_fired_at` is still NULL. These sat out
//    the 15-minute settle window without being cancelled — safe to send.
//
// 2. Fire Refund reversals: orders where Purchase already fired
//    (`meta_purchase_fired_at` NOT NULL) but the order later transitioned
//    to `cancelled` or `refunded` and no reversal has been sent yet.
//    This catches merchant dashboard cancels (direct DB update, no edge
//    fn), Razorpay/PayU failure webhooks, and any future cancel path.
//
// Runs every 2 minutes → worst-case reversal latency = 2 min. Meta's
// attribution windows are 1-7 days so this is well within their tolerance.

import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { fireRefundCapi } from "../_shared/fireRefundCapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cap per-run so a burst of stuck orders never blows the cron budget.
const MAX_PER_RUN = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results = { deferred_fired: 0, deferred_skipped: 0, refunds_fired: 0, refunds_skipped: 0 };

  // ── Job 1: deferred Purchases whose 15-min settle window has passed ──
  const nowIso = new Date().toISOString();
  const { data: deferred } = await supabase
    .from("orders")
    .select("id")
    .is("meta_purchase_fired_at", null)
    .not("meta_purchase_deferred_until", "is", null)
    .lte("meta_purchase_deferred_until", nowIso)
    // Guard against orders cancelled during the settle window — those go to Job 2.
    .in("status", ["paid", "confirmed", "partially_paid", "delivered", "completed"])
    .limit(MAX_PER_RUN);

  for (const row of deferred || []) {
    const r = await firePurchaseCapi(supabase, row.id, {
      source: "cron",
      allowImmediate: true, // bypass the 15-min guard — window has already passed
    });
    if (r.ok && !r.reason) results.deferred_fired++;
    else results.deferred_skipped++;
  }

  // ── Job 2: pending Refund reversals for cancels-after-Purchase ──
  const { data: cancelled } = await supabase
    .from("orders")
    .select("id, status")
    .not("meta_purchase_fired_at", "is", null)
    .is("meta_refund_fired_at", null)
    .in("status", ["cancelled", "refunded"])
    .limit(MAX_PER_RUN);

  for (const row of cancelled || []) {
    const r = await fireRefundCapi(supabase, row.id, { source: "cron" });
    if (r.ok && !r.reason) results.refunds_fired++;
    else results.refunds_skipped++;
  }

  console.log("[capi-purchase-retry]", JSON.stringify(results));
  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
