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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // admin check
    const { data: roleRow } = await admin.from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const withdrawal_id = body.withdrawal_id;
    const note = body.note ? String(body.note).slice(0, 500) : null;
    const payout_ref = body.payout_ref ? String(body.payout_ref).slice(0, 200) : null;
    if (!withdrawal_id) return json({ error: "withdrawal_id required" }, 400);

    const { data: w } = await admin.from("partner_withdrawals").select("*").eq("id", withdrawal_id).maybeSingle();
    if (!w) return json({ error: "not found" }, 404);

    const now = new Date().toISOString();

    if (action === "approve") {
      if (w.status !== "pending") return json({ error: "Only pending can be approved" }, 409);
      await admin.from("partner_withdrawals").update({ status: "approved", admin_note: note, processed_at: now }).eq("id", w.id);
      await admin.from("partner_notifications").insert({
        partner_id: w.partner_id, type: "withdrawal_approved",
        title: `Withdrawal approved: ₹${w.amount}`,
        body: "Payout will be processed shortly.",
        metadata: { withdrawal_id: w.id },
      });
      return json({ ok: true });
    }

    if (action === "reject") {
      if (!["pending", "approved"].includes(w.status)) return json({ error: "Cannot reject this status" }, 409);
      const { error: refundErr } = await admin.rpc("wallet_refund_withdrawal", { _withdrawal_id: w.id });
      if (refundErr) return json({ error: refundErr.message }, 500);
      await admin.from("partner_withdrawals").update({
        status: "rejected", admin_note: note, processed_at: now,
      }).eq("id", w.id);
      await admin.from("partner_notifications").insert({
        partner_id: w.partner_id, type: "withdrawal_rejected",
        title: `Withdrawal rejected: ₹${w.amount}`,
        body: note || "Your withdrawal was rejected. The amount has been returned to your balance.",
        metadata: { withdrawal_id: w.id },
      });
      return json({ ok: true });
    }

    if (action === "mark_paid") {
      if (w.status !== "approved") return json({ error: "Approve before marking paid" }, 409);
      if (!payout_ref) return json({ error: "payout_ref (UTR) required" }, 400);
      const { error: settleErr } = await admin.rpc("wallet_settle_withdrawal", { _withdrawal_id: w.id });
      if (settleErr) return json({ error: settleErr.message }, 500);
      await admin.from("partner_withdrawals").update({
        status: "paid", payout_ref, paid_at: now, admin_note: note ?? w.admin_note,
      }).eq("id", w.id);
      // Mark associated commissions paid
      await admin.from("partner_commissions").update({ status: "paid" })
        .eq("partner_id", w.partner_id).eq("status", "approved");
      await admin.from("partner_notifications").insert({
        partner_id: w.partner_id, type: "withdrawal_paid",
        title: `Payout received: ₹${w.amount}`,
        body: `UTR/Reference: ${payout_ref}`,
        metadata: { withdrawal_id: w.id, payout_ref },
      });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
