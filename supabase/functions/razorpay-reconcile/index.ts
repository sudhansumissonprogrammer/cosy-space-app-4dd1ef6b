// Razorpay reconcile job.
//
// Why this exists:
//   The frontend confirms orders by calling razorpay-verify / razorpay-payment-status
//   AFTER the shopper returns from the UPI app or Razorpay modal. If the browser
//   is closed/killed/loses network before that happens, the order stays "pending"
//   forever even though Razorpay captured the money. CAPI never fires either —
//   so ROAS attribution is also lost.
//
// What this does:
//   Every few minutes (via pg_cron), scan all orders that are still `pending`
//   with `payment_method='razorpay'` and `razorpay_order_id IS NOT NULL` from
//   the last 24 hours. For each, ask Razorpay if any payment was captured,
//   and if yes, flip the order to confirmed/partially_paid + fire CAPI.
//
// Idempotent: skips orders already confirmed; firePurchaseCapi has its own stamp.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional payload: { order_id?: string } to reconcile one order on demand.
  let onlyOrderId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.order_id === "string") onlyOrderId = body.order_id;
  } catch { /* no body / not JSON — fine */ }

  // Pull pending razorpay orders. Cap to 24h window so we don't hammer
  // Razorpay with stale orders forever — unless an explicit order_id is passed
  // (manual backfill case), in which case we ignore the age cap.
  let q = supabase
    .from("orders")
    .select("id, store_id, status, payment_type, razorpay_order_id, notes, created_at")
    .eq("status", "pending")
    .eq("payment_method", "razorpay")
    .not("razorpay_order_id", "is", null)
    .limit(200);
  if (onlyOrderId) {
    q = q.eq("id", onlyOrderId);
  } else {
    q = q.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  }

  const { data: orders, error } = await q;
  if (error) {
    console.error("reconcile fetch error", error);
    return json({ error: error.message }, 500);
  }

  // Group by store so we fetch payment config once per store.
  const byStore = new Map<string, any[]>();
  for (const o of orders ?? []) {
    const arr = byStore.get(o.store_id) ?? [];
    arr.push(o as any);
    byStore.set(o.store_id, arr);
  }

  let confirmed = 0;
  let failedFinal = 0;
  let stillPending = 0;

  for (const [storeId, group] of byStore.entries()) {
    const { data: cfg } = await supabase
      .from("store_payment_config")
      .select("razorpay_key_id, razorpay_key_secret")
      .eq("store_id", storeId)
      .maybeSingle();
    if (!cfg?.razorpay_key_id || !cfg.razorpay_key_secret) continue;
    const auth = "Basic " + btoa(`${cfg.razorpay_key_id}:${cfg.razorpay_key_secret}`);

    for (const o of group) {
      try {
        const r = await fetch(
          `https://api.razorpay.com/v1/orders/${o.razorpay_order_id}/payments`,
          { headers: { Authorization: auth } },
        );
        if (!r.ok) continue;
        const body = await r.json();
        const items: any[] = Array.isArray(body?.items) ? body.items : [];

        const captured = items.find(
          (p) => p.status === "captured" || p.status === "authorized",
        );

        if (captured) {
          // Auto-capture if only authorized
          if (captured.status === "authorized") {
            await fetch(`https://api.razorpay.com/v1/payments/${captured.id}/capture`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: auth },
              body: JSON.stringify({ amount: captured.amount, currency: captured.currency }),
            }).catch(() => {});
          }

          const newStatus = o.payment_type === "partial" ? "partially_paid" : "confirmed";
          // Race-safe: only update if still pending
          const { data: upd } = await supabase
            .from("orders")
            .update({
              status: newStatus,
              payment_method: "razorpay",
              notes: `Razorpay Payment ID: ${captured.id} (reconciled)`,
            })
            .eq("id", o.id)
            .eq("status", "pending")
            .select("id");

          if (upd && upd.length > 0) {
            confirmed++;
            // Fire Meta CAPI Purchase (idempotent via meta_purchase_fired_at stamp)
            void firePurchaseCapi(supabase, o.id, { source: "razorpay-reconcile" });
          }
          continue;
        }

        // No captured payment. If any failed/created entries exist and order
        // is older than 2 hours, mark failed so it stops being scanned.
        const ageMs = Date.now() - new Date(o.created_at).getTime();
        if (ageMs > 2 * 60 * 60 * 1000 && items.length > 0) {
          await supabase
            .from("orders")
            .update({ status: "failed", notes: "Razorpay: no captured payment within 2h" })
            .eq("id", o.id)
            .eq("status", "pending");
          failedFinal++;
        } else {
          stillPending++;
        }
      } catch (e) {
        console.error("reconcile order error", o.id, e);
      }
    }
  }

  // SECOND PASS — CAPI back-fill.
  // Catches orders that ARE confirmed (or delivered/shipped/etc) but never
  // had Meta CAPI fired — e.g. status flipped manually from pending → delivered
  // bypassing razorpay-verify, or a transient CAPI failure when the order was
  // first confirmed. firePurchaseCapi itself is idempotent via the
  // meta_purchase_fired_at stamp, so this is safe to re-run.
  const capiBackfilled = await capiBackfill(supabase, onlyOrderId);

  return json({
    scanned: orders?.length ?? 0,
    confirmed,
    failed_final: failedFinal,
    still_pending: stillPending,
    capi_backfilled: capiBackfilled,
  });
});

const PAID_STATUSES = [
  "paid", "confirmed", "partially_paid", "processing", "shipped", "delivered", "completed",
];

async function capiBackfill(
  supabase: ReturnType<typeof createClient>,
  onlyOrderId: string | null,
): Promise<number> {
  // Look back 7 days for any razorpay-paid order that has browser signals
  // but never had CAPI fired.
  let q = supabase
    .from("orders")
    .select("id, created_at, buyer_fbp, buyer_fbc, buyer_user_agent, meta_event_id, meta_purchase_fired_at, status, payment_method")
    .in("status", PAID_STATUSES)
    .eq("payment_method", "razorpay")
    .is("meta_purchase_fired_at", null)
    .limit(100);
  if (onlyOrderId) {
    q = q.eq("id", onlyOrderId);
  } else {
    q = q.gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  }
  const { data: rows, error } = await q;
  if (error || !rows) return 0;

  let fired = 0;
  for (const o of rows) {
    // firePurchaseCapi internally re-checks browser signals and stamps even
    // when no Pixel is configured, so we don't need to filter here.
    const res = await firePurchaseCapi(supabase, o.id, { source: "razorpay-reconcile-backfill" });
    if (res.ok && res.reason !== "already_fired" && res.reason !== "manual_order") {
      fired++;
    }
  }
  return fired;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
