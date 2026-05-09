import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const method = String(body.method || "").toLowerCase();
    const upi_id = body.upi_id ? String(body.upi_id).trim() : null;
    const bank_account_no = body.bank_account_no ? String(body.bank_account_no).trim() : null;
    const bank_ifsc = body.bank_ifsc ? String(body.bank_ifsc).trim().toUpperCase() : null;
    const bank_account_name = body.bank_account_name ? String(body.bank_account_name).trim() : null;

    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);
    if (!["upi", "bank"].includes(method)) return json({ error: "Invalid method" }, 400);
    if (method === "upi" && !upi_id) return json({ error: "UPI ID required" }, 400);
    if (method === "bank" && (!bank_account_no || !bank_ifsc || !bank_account_name)) {
      return json({ error: "Bank details required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: partner } = await admin.from("partners")
      .select("id,status").eq("user_id", userData.user.id).maybeSingle();
    if (!partner) return json({ error: "Not a partner" }, 403);
    if (partner.status !== "active") return json({ error: "Partner account not active" }, 403);

    const { data: settings } = await admin.from("partner_settings").select("minimum_withdrawal").limit(1).maybeSingle();
    const minimum = Number(settings?.minimum_withdrawal ?? 500);
    if (amount < minimum) return json({ error: `Minimum withdrawal is ₹${minimum}` }, 400);

    const { data: wallet } = await admin.from("partner_wallets").select("*").eq("partner_id", partner.id).maybeSingle();
    const approved = Number(wallet?.approved ?? 0);
    if (amount > approved) return json({ error: `Insufficient withdrawable balance (₹${approved})` }, 400);

    // Block if there's already a pending/approved request
    const { count: openCount } = await admin.from("partner_withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partner.id)
      .in("status", ["pending", "approved"]);
    if ((openCount ?? 0) > 0) return json({ error: "You already have a withdrawal in progress" }, 409);

    const { data: w, error: wErr } = await admin.from("partner_withdrawals").insert({
      partner_id: partner.id, amount, method,
      upi_id, bank_account_no, bank_ifsc, bank_account_name,
      status: "pending",
    }).select().single();
    if (wErr || !w) return json({ error: wErr?.message || "Failed" }, 500);

    const { error: lockErr } = await admin.rpc("wallet_lock_for_withdrawal", { _withdrawal_id: w.id });
    if (lockErr) {
      // rollback
      await admin.from("partner_withdrawals").delete().eq("id", w.id);
      return json({ error: lockErr.message }, 500);
    }

    await admin.from("partner_notifications").insert({
      partner_id: partner.id, type: "withdrawal_requested",
      title: `Withdrawal requested: ₹${amount}`,
      body: "Your withdrawal request is being reviewed.",
      metadata: { withdrawal_id: w.id },
    });

    return json({ withdrawal: w });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
