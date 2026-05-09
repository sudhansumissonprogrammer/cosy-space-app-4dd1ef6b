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
    const isAdmin = !!roleRow;
    let partnerId: string | null = null;
    if (!isAdmin) {
      const { data: p } = await admin.from("partners").select("id").eq("user_id", ud.user.id).maybeSingle();
      if (!p) return j({ error: "not a partner" }, 403);
      partnerId = p.id;
    }
    const filter = (q: any) => (partnerId ? q.eq("partner_id", partnerId) : q);

    const now = Date.now();
    const since7 = new Date(now - 7 * 86400_000).toISOString();
    const since30 = new Date(now - 30 * 86400_000).toISOString();
    const since90 = new Date(now - 90 * 86400_000).toISOString();

    const range = async (table: string, col: string, since: string, extra?: (q: any) => any) => {
      let q: any = admin.from(table).select("id", { count: "exact", head: true }).gte(col, since);
      q = filter(q);
      if (extra) q = extra(q);
      const { count } = await q;
      return count ?? 0;
    };

    const [
      clicks7, clicks30, clicks90,
      sign7, sign30, sign90,
      paid7, paid30, paid90,
      comms,
    ] = await Promise.all([
      range("partner_referral_clicks", "created_at", since7),
      range("partner_referral_clicks", "created_at", since30),
      range("partner_referral_clicks", "created_at", since90),
      range("partner_referrals", "created_at", since7),
      range("partner_referrals", "created_at", since30),
      range("partner_referrals", "created_at", since90),
      range("partner_referrals", "first_paid_at", since7, (q) => q.eq("status","paid").not("first_paid_at","is",null)),
      range("partner_referrals", "first_paid_at", since30, (q) => q.eq("status","paid").not("first_paid_at","is",null)),
      range("partner_referrals", "first_paid_at", since90, (q) => q.eq("status","paid").not("first_paid_at","is",null)),
      filter(admin.from("partner_commissions").select("commission_amount,status,created_at,store_id").gte("created_at", since90)),
    ]);

    const byDay = new Map<string, number>();
    (comms.data ?? []).forEach((c: any) => {
      if (c.status === "reversed") return;
      const d = String(c.created_at).slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + Number(c.commission_amount || 0));
    });
    const earnings_series = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }));

    // referred stores subscriptions
    const refStoresQ: any = filter(admin.from("partner_referrals").select("store_id"));
    const { data: refStores } = await refStoresQ;
    const storeIds = (refStores ?? []).map((r: any) => r.store_id).filter(Boolean);

    let active = 0, churned = 0, trialing = 0, mrr = 0;
    const planMix = new Map<string, number>();

    if (storeIds.length) {
      const { data: assigns } = await admin.from("store_plan_assignments")
        .select("store_id,billing_status,custom_price,plan_id").in("store_id", storeIds);
      const planIds = Array.from(new Set((assigns ?? []).map((a: any) => a.plan_id))).filter(Boolean);
      const { data: plans } = planIds.length
        ? await admin.from("plans").select("id,name,price").in("id", planIds)
        : { data: [] as any[] };
      const planMap = new Map((plans ?? []).map((p: any) => [p.id, p]));

      (assigns ?? []).forEach((a: any) => {
        const plan = planMap.get(a.plan_id);
        const price = Number(a.custom_price ?? plan?.price ?? 0);
        if (a.billing_status === "trialing") trialing++;
        if (["active", "trialing"].includes(a.billing_status)) {
          active++;
          mrr += price;
          const name = plan?.name ?? "Unknown";
          planMix.set(name, (planMix.get(name) ?? 0) + 1);
        } else if (["cancelled", "suspended"].includes(a.billing_status)) {
          churned++;
        }
      });
    }

    const total_subs = active + churned;
    const churn_rate = total_subs ? +((churned / total_subs) * 100).toFixed(1) : 0;
    const arpu = active ? +((mrr / active).toFixed(2)) : 0;

    return j({
      scope: isAdmin ? "global" : "partner",
      windows: {
        clicks: { d7: clicks7, d30: clicks30, d90: clicks90 },
        signups: { d7: sign7, d30: sign30, d90: sign90 },
        paid: { d7: paid7, d30: paid30, d90: paid90 },
      },
      funnel: {
        clicks: clicks30, signups: sign30, paid: paid30,
        click_to_signup: clicks30 ? +((sign30 / clicks30) * 100).toFixed(1) : 0,
        signup_to_paid: sign30 ? +((paid30 / sign30) * 100).toFixed(1) : 0,
      },
      subscriptions: { active, churned, trialing, mrr, arr: +(mrr * 12).toFixed(2), churn_rate, arpu },
      plan_mix: Array.from(planMix.entries()).map(([name, count]) => ({ name, count })),
      earnings_series,
    }, 200, { "Cache-Control": "private, max-age=15" });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
function j(b: unknown, s = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}
