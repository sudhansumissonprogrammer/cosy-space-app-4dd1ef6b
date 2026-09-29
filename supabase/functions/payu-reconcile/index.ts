// PayU reconcile job.
//
// PayU Merchant Hosted/Bolt relies on the shopper returning to the storefront
// OR PayU calling our notify URL. If the mobile browser tab is killed during a
// UPI handoff, and the merchant has not configured Notify URL in PayU Dashboard,
// paid orders can remain `pending` forever. This cron polls PayU's
// verify_payment API for recent PayU orders and fixes the local order state.
//
// Idempotent: order updates are guarded by status, and firePurchaseCapi is
// stamped on orders.meta_purchase_fired_at.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { fireWaOrderEvent } from "../_shared/wa-fire-order-event.ts";
import { timingSafeEqual } from "../_shared/security.ts";
import { verifyPayuAttempts, type PayuEnv } from "../_shared/payuHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const PAID_STATUSES = ["paid", "confirmed", "partially_paid", "delivered", "completed"];

function txnidForOrder(orderId: string): string {
  return `sb_${String(orderId).replace(/-/g, "").slice(0, 16)}`;
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient<any>(Deno.env.get("SUPABASE_URL")!, serviceRole);

  // AUTH — accept either:
  //  1) Authorization: Bearer <service-role-key> for manual/internal runs
  //  2) x-cron-secret matching env secrets
  //  3) x-cron-secret verified against public.cron_auth via SECURITY DEFINER RPC
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const providedCron = req.headers.get("x-cron-secret") || "";
  const envSecret =
    Deno.env.get("PAYU_RECONCILE_CRON_SECRET") ||
    Deno.env.get("CRON_SECRET") ||
    Deno.env.get("PREWARM_CRON_SECRET") ||
    "";

  let authorized = !!bearer && timingSafeEqual(bearer, serviceRole);
  if (!authorized && providedCron && envSecret) authorized = timingSafeEqual(providedCron, envSecret);
  if (!authorized && providedCron) {
    const { data } = await supabase.rpc("verify_cron_secret", { _secret: providedCron });
    authorized = data === true;
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  let onlyOrderId: string | null = null;
  // FAST MODE (runs every minute): only look at PayU orders minted in the last
  // ~20 minutes that are still pending. That is the window where a shopper is
  // literally standing in front of the "processing" screen after paying in
  // PhonePe/GPay. PayU has no notify-URL configured for these merchants and the
  // mobile tab is frequently discarded while the UPI app is in the foreground,
  // so the browser poller can never be the only confirmation path.
  let fast = false;
  try {
    const body = await req.json();
    if (body && typeof body.order_id === "string") onlyOrderId = body.order_id;
    if (body && body.fast === true) fast = true;
  } catch { /* no body */ }


  let q = supabase
    .from("orders")
    .select("id, store_id, status, payment_type, customer_phone, storefront_customer_id, created_at, payu_txnids")
    .eq("payment_method", "payu")
    .order("created_at", { ascending: false })
    .limit(fast ? 40 : 200);

  if (onlyOrderId) {
    q = q.eq("id", onlyOrderId);
  } else if (fast) {
    q = q
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 20 * 60 * 1000).toISOString());
  } else {
    q = q
      // Include cancelled/failed too: if a shopper paid but the browser returned
      // late, the gateway is source of truth and we must recover the order.
      .in("status", ["pending", "cancelled", "failed"])
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  }


  const { data: orders, error } = await q;
  if (error) {
    console.error("payu-reconcile fetch error", error);
    return json({ error: error.message }, 500);
  }

  if (!onlyOrderId && (!orders || orders.length === 0)) {
    const capiBackfilled = fast ? 0 : await capiBackfill(supabase as any, null);
    return json({ ok: true, scanned: 0, skipped: "no_recent_payu_orders", capi_backfilled: capiBackfilled });
  }

  const byStore = new Map<string, any[]>();
  for (const o of orders || []) {
    const arr = byStore.get(o.store_id) || [];
    arr.push(o);
    byStore.set(o.store_id, arr);
  }

  let confirmed = 0;
  let failedFinal = 0;
  let stillPending = 0;
  let notFound = 0;

  for (const [storeId, group] of byStore.entries()) {
    const { data: cfg } = await supabase
      .from("store_payment_config")
      .select("payu_merchant_key, payu_merchant_salt, payu_env")
      .eq("store_id", storeId)
      .maybeSingle();
    if (!cfg?.payu_merchant_key || !cfg?.payu_merchant_salt) continue;

    const env = (cfg.payu_env === "sandbox" ? "sandbox" : "production") as PayuEnv;

    for (const o of group) {
      try {
        if (PAID_STATUSES.includes(String(o.status || "").toLowerCase())) {
          await firePurchaseCapi(supabase as any, o.id, { source: "payu-reconcile-paid-backfill" });
          // Backfill: if a previous reconcile pass confirmed the order but
          // wa-order-event was never called, enqueue it now. Idempotent.
          await fireWaOrderEvent(supabase as any, o.id, "order_confirmation");
          continue;
        }


        // A single order can have several PayU attempts (payu-create-txn mints
        // a fresh txnid per attempt so PayU never sees a duplicate id). Check
        // every recorded attempt plus the legacy derived id, and let any PAID
        // attempt win.
        const attemptIds: string[] = Array.from(
          new Set([...(Array.isArray(o.payu_txnids) ? o.payu_txnids : []), txnidForOrder(o.id)]),
        );

        const best = await verifyPayuAttempts({
          env, key: cfg.payu_merchant_key, salt: cfg.payu_merchant_salt, txnids: attemptIds,
        });
        if (!best) {
          notFound++;
          continue;
        }
        const det = best.det;
        const txnid = best.txnid;
        const verdict = best.verdict;
        if (verdict === "PAID") {
          const newStatus = o.payment_type === "partial" ? "partially_paid" : "confirmed";
          const customerId = !o.storefront_customer_id
            ? await findCustomerByPhone(supabase as any, storeId, o.customer_phone)
            : null;
          const update: Record<string, unknown> = {
            status: newStatus,
            payment_method: "payu",
            notes: `PayU Txn ID: ${txnid}${det.mihpayid ? ` (mihpayid: ${det.mihpayid})` : ""} (reconciled)`,
            payment_verified: true,
            payment_verified_at: new Date().toISOString(),
          };
          if (customerId) update.storefront_customer_id = customerId;

          const { data: upd } = await supabase
            .from("orders")
            .update(update)
            .eq("id", o.id)
            .eq("store_id", storeId)
            .not("status", "in", `(${PAID_STATUSES.join(",")})`)
            .select("id");

          if (upd && upd.length > 0) {
            confirmed++;
            await firePurchaseCapi(supabase as any, o.id, { source: "payu-reconcile" });
            // Safety net: shopper's tab was gone, so notify-order never ran.
            // Fire order_confirmation WhatsApp from the reconcile path too.
            await fireWaOrderEvent(supabase as any, o.id, "order_confirmation");
          }
          continue;
        }

        if (verdict === "FAILED") {
          const ageMs = Date.now() - new Date(o.created_at).getTime();
          // Avoid hijacking a very fresh UPI attempt where PayU briefly reports
          // failure/dropped before the final state settles.
          if (o.status === "pending" && ageMs > 30 * 60 * 1000) {
            const detail = det.unmappedstatus || det.status || "failed";
            const { data: upd } = await supabase
              .from("orders")
              .update({ status: "cancelled", notes: `PayU ${detail} for ${txnid} (reconciled)` })
              .eq("id", o.id)
              .eq("store_id", storeId)
              .eq("status", "pending")
              .select("id");
            if (upd && upd.length > 0) failedFinal++;
          }
          continue;
        }

        stillPending++;
      } catch (e) {
        console.error("payu-reconcile order error", o.id, e);
      }
    }
  }

  const capiBackfilled = fast ? 0 : await capiBackfill(supabase as any, onlyOrderId);

  return json({
    ok: true,
    scanned: orders?.length || 0,
    confirmed,
    failed_final: failedFinal,
    still_pending: stillPending,
    not_found: notFound,
    capi_backfilled: capiBackfilled,
  });
});

async function capiBackfill(supabase: any, onlyOrderId: string | null): Promise<number> {
  let q = supabase
    .from("orders")
    .select("id, created_at, status, payment_method, meta_purchase_fired_at")
    .eq("payment_method", "payu")
    .in("status", PAID_STATUSES)
    .is("meta_purchase_fired_at", null)
    .limit(100);
  if (onlyOrderId) q = q.eq("id", onlyOrderId);
  else q = q.gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const { data: rows } = await q;
  let fired = 0;
  for (const o of rows || []) {
    const res = await firePurchaseCapi(supabase as any, o.id, { source: "payu-reconcile-backfill" });
    if (res.ok && res.reason !== "already_fired" && res.reason !== "manual_order") fired++;
  }
  return fired;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}