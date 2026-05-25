// Polled by client after Cashfree redirect. Verifies status and applies recharge if PAID.
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
    const orderId = String(body.order_id || "");
    if (!orderId) return j({ error: "order_id required" }, 400);

    const { data: rec } = await supabase
      .from("store_wallet_recharges")
      .select("*, stores!inner(owner_id)")
      .eq("cashfree_order_id", orderId)
      .single();
    if (!rec) return j({ error: "Not found" }, 404);
    if ((rec as any).stores.owner_id !== user.id) return j({ error: "Forbidden" }, 403);

    if (rec.status === "paid") {
      return j({ status: "paid", recharge_id: rec.id });
    }

    // Fetch Cashfree
    const cfRes = await fetch(`${CF_BASE}/orders/${orderId}`, {
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
    });
    const cf = await cfRes.json();
    if (!cfRes.ok) {
      return j({ status: rec.status, error: cf.message || "Cashfree status check failed" });
    }

    const cfStatus = String(cf.order_status || "").toUpperCase();
    if (cfStatus === "PAID") {
      const { data: applied } = await supabase.rpc("wallet_apply_recharge", { _recharge_id: rec.id });
      // Get payment id if available
      const payRes = await fetch(`${CF_BASE}/orders/${orderId}/payments`, {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
        },
      });
      const pays = await payRes.json().catch(() => []);
      const success = Array.isArray(pays) ? pays.find((p: any) => p.payment_status === "SUCCESS") : null;
      if (success) {
        await supabase
          .from("store_wallet_recharges")
          .update({
            cashfree_payment_id: String(success.cf_payment_id),
            payment_method: success.payment_group || null,
          })
          .eq("id", rec.id)
          .is("cashfree_payment_id", null);
      }
      return j({ status: "paid", applied: !!applied, recharge_id: rec.id });
    }

    if (["EXPIRED", "TERMINATED", "FAILED"].includes(cfStatus)) {
      await supabase
        .from("store_wallet_recharges")
        .update({ status: "failed", failure_reason: cfStatus })
        .eq("id", rec.id)
        .eq("status", "pending");
      return j({ status: "failed" });
    }

    return j({ status: "pending", cf_status: cfStatus });
  } catch (e) {
    return j({ error: String((e as any)?.message || e) }, 500);
  }
});
