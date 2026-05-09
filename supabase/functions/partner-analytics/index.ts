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

    // resolve partner (or admin global)
    const { data: roleRow } = await admin.from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;

    let partnerId: string | null = null;
    if (!isAdmin) {
      const { data: p } = await admin.from("partners").select("id").eq("user_id", userData.user.id).maybeSingle();
      if (!p) return json({ error: "not a partner" }, 403);
      partnerId = p.id;
    }

    const filter = (q: any) => (partnerId ? q.eq("partner_id", partnerId) : q);

    // earnings 90d
    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    const { data: comms } = await filter(
      admin.from("partner_commissions").select("commission_amount,status,created_at").gte("created_at", since)
    );

    // group by day
    const byDay = new Map<string, number>();
    (comms ?? []).forEach((c: any) => {
      if (c.status === "reversed") return;
      const day = String(c.created_at).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(c.commission_amount || 0));
    });
    const earnings_series = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }));

    // funnel
    const { count: clicks } = await filter(admin.from("partner_referral_clicks").select("id", { count: "exact", head: true }));
    const { count: signups } = await filter(admin.from("partner_referrals").select("id", { count: "exact", head: true }));
    const { count: paidRefs } = await filter(
      admin.from("partner_referrals").select("id", { count: "exact", head: true }).eq("status", "paid")
    );

    // active vs churned referred stores
    const refStoresQ = admin.from("partner_referrals").select("store_id");
    const { data: refStores } = await filter(refStoresQ);
    const storeIds = (refStores ?? []).map((r: any) => r.store_id).filter(Boolean);
    let active = 0, churned = 0, mrr = 0;
    if (storeIds.length) {
      const { data: assigns } = await admin.from("store_plan_assignments")
        .select("store_id,billing_status,custom_price,plan_id")
        .in("store_id", storeIds);
      const planIds = Array.from(new Set((assigns ?? []).map((a: any) => a.plan_id))).filter(Boolean);
      const { data: plans } = planIds.length
        ? await admin.from("plans").select("id,price").in("id", planIds)
        : { data: [] as any[] };
      const planMap = new Map((plans ?? []).map((p: any) => [p.id, Number(p.price || 0)]));
      (assigns ?? []).forEach((a: any) => {
        if (["active", "trialing"].includes(a.billing_status)) {
          active++;
          mrr += Number(a.custom_price ?? planMap.get(a.plan_id) ?? 0);
        } else if (["cancelled", "suspended"].includes(a.billing_status)) {
          churned++;
        }
      });
    }

    return json({
      scope: isAdmin ? "global" : "partner",
      funnel: {
        clicks: clicks ?? 0, signups: signups ?? 0, paid: paidRefs ?? 0,
        click_to_signup: clicks ? +(((signups ?? 0) / clicks) * 100).toFixed(1) : 0,
        signup_to_paid: signups ? +(((paidRefs ?? 0) / signups) * 100).toFixed(1) : 0,
      },
      subscriptions: { active, churned, mrr },
      earnings_series,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
