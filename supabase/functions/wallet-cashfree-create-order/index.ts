// Creates a Cashfree order to recharge a store's commission wallet.
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

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: ud } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const user = ud?.user;
    if (!user) return j({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const storeId = String(body.store_id || "");
    const amount = Number(body.amount || 0);
    if (!storeId) return j({ error: "store_id required" }, 400);

    const { data: store } = await supabase
      .from("stores")
      .select("id, owner_id, name, owner_email, whatsapp_number, billing_mode")
      .eq("id", storeId)
      .single();
    if (!store || store.owner_id !== user.id) return j({ error: "Forbidden" }, 403);
    if (store.billing_mode !== "commission") {
      return j({ error: "Store is not in commission mode" }, 400);
    }

    const { data: cfg } = await supabase
      .from("store_commission_config")
      .select("min_recharge")
      .eq("store_id", storeId)
      .maybeSingle();
    const minRecharge = Number(cfg?.min_recharge ?? 700);
    if (!Number.isFinite(amount) || amount < minRecharge) {
      return j({ error: `Minimum recharge is ₹${minRecharge}` }, 400);
    }
    if (amount > 200000) return j({ error: "Max ₹2,00,000 per recharge" }, 400);

    const orderId = `wallet_${storeId.slice(0, 8)}_${Date.now()}`;
    const rawPhone = store.whatsapp_number || user.phone || "";
    const digits = String(rawPhone).replace(/\D/g, "").slice(-10);
    const customerPhone = digits.length === 10 ? digits : "9999999999";

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
        notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/wallet-cashfree-webhook`,
      },
      order_note: `Wallet recharge for ${store.name}`,
      order_tags: { store_id: storeId, kind: "wallet_recharge" },
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
      console.error("Cashfree wallet recharge error", cfData);
      return j({ error: cfData.message || "Cashfree order failed", details: cfData }, 502);
    }

    const { error: insErr } = await supabase.from("store_wallet_recharges").insert({
      store_id: storeId,
      cashfree_order_id: orderId,
      amount,
      currency: "INR",
      status: "pending",
      raw_payload: cfData,
    });
    if (insErr) {
      console.error("recharge insert error", insErr);
      return j({ error: "Failed to record recharge", details: insErr.message }, 500);
    }

    return j({
      order_id: orderId,
      payment_session_id: cfData.payment_session_id,
      amount,
      currency: "INR",
    });
  } catch (e) {
    console.error("wallet-cashfree-create-order error", e);
    return j({ error: String((e as any)?.message || e) }, 500);
  }
});
