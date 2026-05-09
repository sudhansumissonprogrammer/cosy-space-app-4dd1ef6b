import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return j({ error: "unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", ud.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return j({ error: "forbidden" }, 403);

    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString();

    const [partners, clicks, signups, paid, comms30, walletsAgg, payoutsPending, topPartners] = await Promise.all([
      admin.from("partners").select("id,status", { count: "exact", head: true }),
      admin.from("partner_referral_clicks").select("id", { count: "exact", head: true }).gte("created_at", since30),
      admin.from("partner_referrals").select("id", { count: "exact", head: true }).gte("created_at", since30),
      admin.from("partner_referrals").select("id", { count: "exact", head: true }).eq("status", "paid").gte("created_at", since90),
      admin.from("partner_commissions").select("commission_amount,status,created_at").gte("created_at", since90),
      admin.from("partner_wallets").select("pending,approved,locked,paid"),
      admin.from("partner_withdrawals").select("amount,status").in("status", ["pending", "approved"]),
      admin.from("partners").select("id,partner_code,name,total_earnings").order("total_earnings", { ascending: false }).limit(10),
    ]);

    const totalsByDay = new Map<string, number>();
    (comms30.data ?? []).forEach((c: any) => {
      if (c.status === "reversed") return;
      const d = String(c.created_at).slice(0, 10);
      totalsByDay.set(d, (totalsByDay.get(d) ?? 0) + Number(c.commission_amount || 0));
    });
    const earnings_series = Array.from(totalsByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }));

    const wallet_totals = (walletsAgg.data ?? []).reduce(
      (acc: any, w: any) => ({
        pending: acc.pending + Number(w.pending || 0),
        approved: acc.approved + Number(w.approved || 0),
        locked: acc.locked + Number(w.locked || 0),
        paid: acc.paid + Number(w.paid || 0),
      }), { pending: 0, approved: 0, locked: 0, paid: 0 },
    );
    const payout_liability = (payoutsPending.data ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

    return j({
      partners_total: partners.count ?? 0,
      clicks_30d: clicks.count ?? 0,
      signups_30d: signups.count ?? 0,
      paid_90d: paid.count ?? 0,
      earnings_series,
      wallet_totals,
      payout_liability,
      top_partners: topPartners.data ?? [],
    });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
