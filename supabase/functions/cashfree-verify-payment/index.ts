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
    const paidPayment = await getSuccessfulPayment(order_id);

    if (status === "PAID" || paidPayment) {
      await markPaid(supabase, payment, cfOrder, paidPayment);
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
    return jsonRes({ error: String((err as any)?.message || err) }, 500);
  }
});

// Parses an anchor day (1-28) from assignment.notes via tag like [billing_anchor_day:5]
function getAnchorDay(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const m = notes.match(/\[billing_anchor_day:(\d{1,2})\]/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  if (isNaN(d) || d < 1 || d > 28) return null;
  return d;
}

// Computes the next period end anchored to a specific day-of-month.
// Always returns the NEXT occurrence of `anchorDay` after `from` (strictly future).
function nextAnchoredPeriodEnd(from: Date, anchorDay: number): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), anchorDay, 0, 0, 0));
  if (next.getTime() <= from.getTime()) {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

async function getSuccessfulPayment(orderId: string): Promise<any | null> {
  const res = await fetch(`${CF_BASE}/orders/${orderId}/payments`, {
    headers: {
      "x-api-version": "2023-08-01",
      "x-client-id": CASHFREE_APP_ID,
      "x-client-secret": CASHFREE_SECRET_KEY,
    },
  });
  if (!res.ok) return null;
  const payments = await res.json().catch(() => []);
  return Array.isArray(payments)
    ? payments.find((p) => String(p?.payment_status || "").toUpperCase() === "SUCCESS") || null
    : null;
}

async function markPaid(supabase: any, payment: any, cfOrder: any, cfPayment: any | null) {
  // Idempotent: update only if not already paid
  const periodStart = new Date();
  const defaultPeriodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Get assignment FIRST so we can compute correct period end (anchor day support)
  const { data: assignment } = await supabase
    .from("store_plan_assignments")
    .select("*")
    .eq("store_id", payment.store_id)
    .single();

  const anchorDay = getAnchorDay(assignment?.notes);
  const periodEnd = anchorDay
    ? nextAnchoredPeriodEnd(periodStart, anchorDay)
    : defaultPeriodEnd;

  const { error: payErr } = await supabase
    .from("subscription_payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      cashfree_payment_id: cfPayment?.cf_payment_id ? String(cfPayment.cf_payment_id) : (cfOrder.cf_order_id ? String(cfOrder.cf_order_id) : null),
      payment_method: cfPayment?.payment_group || cfPayment?.payment_method || null,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      raw_payload: { order: cfOrder, payment: cfPayment },
    })
    .eq("id", payment.id)
    .neq("status", "paid"); // race-safe

  if (payErr) console.error("payment update err", payErr);

  if (!assignment) return;

  const updates: any = {
    last_payment_at: new Date().toISOString(),
    grace_period_ends_at: null,
    next_billing_amount: null,
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

  // Unsuspend only if billing-suspended
  await supabase
    .from("stores")
    .update({ is_suspended: false, suspension_reason: null })
    .eq("id", payment.store_id)
    .eq("suspension_reason", "billing");
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
