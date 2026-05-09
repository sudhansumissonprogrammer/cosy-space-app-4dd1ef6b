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

    const { withdrawal_id } = await req.json().catch(() => ({}));
    if (!withdrawal_id) return json({ error: "withdrawal_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: partner } = await admin.from("partners").select("id").eq("user_id", userData.user.id).maybeSingle();
    if (!partner) return json({ error: "forbidden" }, 403);

    const { data: w } = await admin.from("partner_withdrawals").select("*").eq("id", withdrawal_id).maybeSingle();
    if (!w || w.partner_id !== partner.id) return json({ error: "not found" }, 404);
    if (w.status !== "pending") return json({ error: "Only pending requests can be cancelled" }, 409);

    const { error: refundErr } = await admin.rpc("wallet_refund_withdrawal", { _withdrawal_id: w.id });
    if (refundErr) return json({ error: refundErr.message }, 500);

    await admin.from("partner_withdrawals").update({
      status: "cancelled", processed_at: new Date().toISOString(),
    }).eq("id", w.id);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
