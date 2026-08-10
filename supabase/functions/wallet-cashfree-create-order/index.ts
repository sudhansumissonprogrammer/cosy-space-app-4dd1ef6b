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
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      console.error("wallet recharge: missing Authorization header");
      return j({ error: "Please sign in again and retry the recharge." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the JWT via signing keys (getClaims). getUser() fails with
    // "Session from session_id claim in JWT does not exist" on rotated/
    // asymmetric-key sessions, which was breaking wallet recharge.
    let user: { id: string; email?: string | null; phone?: string | null } | null = null;
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: claimsData } = await authClient.auth.getClaims(token);
    const sub = claimsData?.claims?.sub as string | undefined;
    if (sub) {
      user = {
        id: sub,
        email: (claimsData?.claims as any)?.email ?? null,
        phone: (claimsData?.claims as any)?.phone ?? null,
      };
    } else {
      const { data: ud, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !ud?.user) {
        console.error("wallet recharge: auth failed", authErr?.message, "tokenLen", token.length);
        return j({ error: "Session expired. Please refresh the page and try again." }, 401);
      }
      user = { id: ud.user.id, email: ud.user.email, phone: ud.user.phone };
    }

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      console.error("wallet recharge: Cashfree credentials not configured");
      return j({ error: "Payment gateway not configured. Contact support." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const storeId = String(body.store_id || "");
    const amount = Number(body.amount || 0);
    if (!storeId) return j({ error: "store_id required" }, 400);

    const { data: store } = await supabase
      .from("stores")
      .select("id, owner_id, name, owner_email, whatsapp_number, billing_mode")
      .eq("id", storeId)
      .single();
    if (!store) return j({ error: "Store not found" }, 404);

    // Merchants often keep two logins for the same business. Accept the owner,
    // any platform admin, and any account whose verified email matches the
    // store's owner_email — otherwise recharge fails with a bare 403 after an
    // account switch.
    let allowed = store.owner_id === user.id;
    if (!allowed) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      allowed = !!roleRow;
    }
    if (!allowed && user.email && store.owner_email) {
      allowed = String(user.email).toLowerCase() === String(store.owner_email).toLowerCase();
    }
    if (!allowed) {
      return j({
        error:
          "This store belongs to a different account. Sign out and sign in with the store owner's account, then retry the recharge.",
      }, 403);
    }
    if (store.billing_mode !== "commission") {
      return j({ error: "Store is not in commission mode" }, 400);
    }

    const { data: cfg } = await supabase
      .from("store_commission_config")
      .select("min_recharge")
      .eq("store_id", storeId)
      .maybeSingle();
    const minRecharge = Number(cfg?.min_recharge ?? 600);
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
