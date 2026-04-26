// Verifies a Cashfree payment after redirect/return from checkout.
// Called by frontend with order_id; we re-fetch from Cashfree (source of truth).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID")!;
const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY")!;
const CASHFREE_ENV = (Deno.env.get("CASHFREE_ENV") || "production").toLowerCase();
const CF_BASE = CASHFREE_ENV === "sandbox"
  ? "https://sandbox.cashfree.com/pg"
  : "https://api.cashfree.com/pg";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return jsonRes({ error: "Unauthorized" }, 401);

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return jsonRes({ error: "order_id required" }, 400);

    // Look up our row
    const { data: payment } = await supabase
      .from("subscription_payments")
      .select("*, stores!inner(owner_id)")
      .eq("cashfree_order_id", order_id)
      .single();

    if (!payment) return jsonRes({ error: "Order not found" }, 404);
    if ((payment as any).stores.owner_id !== user.id) {
      return jsonRes({ error: "Forbidden" }, 403);
    }

    // If already paid in our DB, return early
    if (payment.status === "paid") {
      return jsonRes({ status: "paid", already_processed: true });
    }

    // Fetch from Cashfree (source of truth)
    const cfRes = await fetch(`${CF_BASE}/orders/${order_id}`, {
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
    });
    const cfOrder = await cfRes.json();

    if (!cfRes.ok) {
      return jsonRes({ error: "Cashfree fetch failed", details: cfOrder }, 502);
    }

    const status = String(cfOrder.order_status || "").toUpperCase();

    if (status === "PAID") {
      await markPaid(supabase, payment, cfOrder);
      return jsonRes({ status: "paid" });
    }

    if (status === "ACTIVE") {
      return jsonRes({ status: "pending", message: "Payment not completed yet" });
    }

    // EXPIRED / TERMINATED / FAILED
    await supabase
      .from("subscription_payments")
      .update({ status: "failed", failure_reason: status, raw_payload: cfOrder })
      .eq("id", payment.id);

    return jsonRes({ status: "failed", cf_status: status });
  } catch (err) {
    console.error("verify error", err);
    return jsonRes({ error: String(err?.message || err) }, 500);
  }
});

async function markPaid(supabase: any, payment: any, cfOrder: any) {
  // Idempotent: update only if not already paid
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: payErr } = await supabase
    .from("subscription_payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      cashfree_payment_id: cfOrder.cf_order_id ? String(cfOrder.cf_order_id) : null,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      raw_payload: cfOrder,
    })
    .eq("id", payment.id)
    .neq("status", "paid"); // race-safe

  if (payErr) console.error("payment update err", payErr);

  // Get assignment to honor admin overrides
  const { data: assignment } = await supabase
    .from("store_plan_assignments")
    .select("*")
    .eq("store_id", payment.store_id)
    .single();

  if (!assignment) return;

  const updates: any = {
    last_payment_at: new Date().toISOString(),
    grace_period_ends_at: null,
  };

  if (assignment.is_one_time) {
    updates.billing_status = "one_time_paid";
    updates.current_period_end = null;
  } else {
    updates.billing_status = "active";
    updates.current_period_end = periodEnd.toISOString();
  }

  await supabase
    .from("store_plan_assignments")
    .update(updates)
    .eq("store_id", payment.store_id);

  // Unsuspend the store if it was suspended for non-payment
  await supabase
    .from("stores")
    .update({ is_suspended: false })
    .eq("id", payment.store_id);
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
