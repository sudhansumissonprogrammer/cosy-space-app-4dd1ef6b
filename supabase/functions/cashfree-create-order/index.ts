// Creates a Cashfree payment order for a store's monthly subscription.
// Idempotent: returns existing pending order if one exists for the same period.
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
    if (!authHeader) {
      return jsonRes({ error: "Missing authorization" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Identify caller
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return jsonRes({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id as string;
    if (!storeId) return jsonRes({ error: "store_id required" }, 400);

    // Verify caller owns the store
    const { data: store } = await supabase
      .from("stores")
      .select("id, owner_id, name, owner_email")
      .eq("id", storeId)
      .single();

    if (!store || store.owner_id !== user.id) {
      return jsonRes({ error: "Forbidden" }, 403);
    }

    // Get billing state
    const { data: stateData } = await supabase.rpc("get_store_billing_state", { _store_id: storeId });
    const state = stateData as any;
    if (!state) return jsonRes({ error: "No plan assigned" }, 400);
    if (state.is_free_lifetime) return jsonRes({ error: "Lifetime plan — no payment required" }, 400);
    if (state.is_one_time && state.billing_status === "one_time_paid") {
      return jsonRes({ error: "One-time plan already paid" }, 400);
    }

    const amount = Number(state.price || 0);
    if (amount <= 0) return jsonRes({ error: "Plan has no price" }, 400);

    // Idempotency: if a pending order exists less than 30 min old, return it
    const { data: existingPending } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("store_id", storeId)
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      // Re-fetch session id from Cashfree (it may have expired — but keep order_id)
      return jsonRes({
        order_id: existingPending.cashfree_order_id,
        payment_session_id: (existingPending.raw_payload as any)?.payment_session_id,
        amount: existingPending.amount,
        currency: existingPending.currency,
        reused: true,
      });
    }

    // Create Cashfree order
    const orderId = `sub_${storeId.slice(0, 8)}_${Date.now()}`;
    const customerPhone = (user.phone || "9999999999").replace(/\D/g, "").slice(-10).padStart(10, "9");

    const cfPayload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user.id,
        customer_email: user.email || store.owner_email || "noreply@shopbanao.in",
        customer_phone: customerPhone,
        customer_name: store.name?.slice(0, 100) || "Merchant",
      },
      order_meta: {
        notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/cashfree-webhook`,
      },
      order_note: `Subscription for ${store.name}`,
      order_tags: { store_id: storeId, plan_id: state.plan_id },
    };

    const cfRes = await fetch(`${CF_BASE}/orders`, {
      method: "POST",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(cfPayload),
    });

    const cfData = await cfRes.json();
    if (!cfRes.ok) {
      console.error("Cashfree error", cfData);
      return jsonRes({ error: cfData.message || "Cashfree order failed", details: cfData }, 502);
    }

    // Persist
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    await supabase.from("subscription_payments").insert({
      store_id: storeId,
      plan_id: state.plan_id,
      cashfree_order_id: orderId,
      amount,
      currency: "INR",
      status: "pending",
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      raw_payload: cfData,
    });

    return jsonRes({
      order_id: orderId,
      payment_session_id: cfData.payment_session_id,
      amount,
      currency: "INR",
      reused: false,
    });
  } catch (err) {
    console.error("create-order error", err);
    return jsonRes({ error: String((err as any)?.message || err) }, 500);
  }
});

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
