// Confirms pending Cashfree store orders by asking Cashfree about every
// attempt we created (orders.cashfree_order_ids). Runs before the generic
// 30-min expiry so a paid shopper who never came back is never cancelled.
// Only cancels a Cashfree order after 30 min when every attempt was checked
// and none is PAID.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";
import { fireWaOrderEvent } from "../_shared/wa-fire-order-event.ts";

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (auth !== `Bearer ${service}`) return new Response("Forbidden", { status: 403 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, service);
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const cutoff = Date.now() - 30 * 60 * 1000;

  const { data: orders } = await supabase
    .from("orders")
    .select("id, store_id, status, payment_type, total, advance_paid, created_at, checkout_token, cashfree_order_ids")
    .eq("payment_method", "cashfree")
    .in("status", ["pending", "cancelled"])
    .eq("payment_verified", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  const configs = new Map<string, any>();
  let confirmed = 0, cancelled = 0;

  for (const o of orders || []) {
    const ids: string[] = o.cashfree_order_ids || [];
    if (!ids.length) continue;
    if (!configs.has(o.store_id)) {
      const { data } = await supabase.from("store_payment_config")
        .select("cashfree_app_id, cashfree_secret_key, cashfree_env").eq("store_id", o.store_id).single();
      configs.set(o.store_id, data);
    }
    const cfg = configs.get(o.store_id);
    if (!cfg?.cashfree_secret_key) continue;
    const base = cfg.cashfree_env === "sandbox" ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

    let paid: { id: string; amount: number } | null = null;
    let allChecked = true;
    for (const id of ids) {
      try {
        const r = await fetch(`${base}/orders/${encodeURIComponent(id)}`, {
          headers: { "x-api-version": "2023-08-01", "x-client-id": cfg.cashfree_app_id || "", "x-client-secret": cfg.cashfree_secret_key },
        });
        if (!r.ok) { allChecked = false; continue; }
        const j = await r.json();
        if (j.order_status === "PAID") { paid = { id, amount: Number(j.order_amount || 0) }; break; }
      } catch { allChecked = false; }
    }

    if (paid) {
      const expected = o.payment_type === "partial" && Number(o.advance_paid) > 0 ? Number(o.advance_paid) : Number(o.total);
      if (Math.abs(paid.amount - expected) > 0.01) {
        console.error("cashfree-reconcile amount mismatch", o.id, expected, paid.amount);
        continue;
      }
      const { data: upd } = await supabase.from("orders").update({
        status: o.payment_type === "partial" ? "partially_paid" : "confirmed",
        notes: `Cashfree Order ID: ${paid.id} (reconciled)`,
        payment_verified: true,
        payment_verified_at: new Date().toISOString(),
      }).eq("id", o.id).eq("payment_verified", false).in("status", ["pending", "cancelled"]).select("id");
      if (upd?.length) {
        confirmed++;
        if (o.checkout_token) {
          await supabase.from("abandoned_carts").update({ recovered: true })
            .eq("store_id", o.store_id).eq("session_token", o.checkout_token);
        }
        await firePurchaseCapi(supabase, o.id, { source: "cashfree-reconcile" });
        await fireWaOrderEvent(supabase, o.id, "order_confirmation");
      }
    } else if (o.status === "pending" && allChecked && new Date(o.created_at).getTime() < cutoff) {
      const { data: upd } = await supabase.from("orders").update({
        status: "cancelled", notes: "Auto-expired: Cashfree reports no payment within 30 min",
      }).eq("id", o.id).eq("status", "pending").eq("payment_verified", false).select("id");
      if (upd?.length) cancelled++;
    }
  }

  console.log("cashfree-reconcile", { checked: orders?.length || 0, confirmed, cancelled });
  return new Response(JSON.stringify({ confirmed, cancelled }), { headers: { "content-type": "application/json" } });
});
