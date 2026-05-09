import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: partner } = await admin
      .from("partners")
      .select("id, partner_code, name, email, mobile, commission_percentage, status, total_earnings, created_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!partner) {
      return new Response(JSON.stringify({ partner: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ count: clicks }, { count: signups }, { count: paid }, commissionsRes] =
      await Promise.all([
        admin
          .from("partner_referral_clicks")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id),
        admin
          .from("partner_referrals")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id),
        admin
          .from("partner_referrals")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id)
          .eq("status", "paid"),
        admin
          .from("partner_commissions")
          .select("commission_amount, status")
          .eq("partner_id", partner.id),
      ]);

    const commissions = commissionsRes.data ?? [];
    const totalEarned = commissions.reduce((s, c: any) => s + Number(c.commission_amount || 0), 0);
    const pending = commissions
      .filter((c: any) => c.status === "pending")
      .reduce((s, c: any) => s + Number(c.commission_amount || 0), 0);
    const approved = commissions
      .filter((c: any) => c.status === "approved")
      .reduce((s, c: any) => s + Number(c.commission_amount || 0), 0);

    return new Response(
      JSON.stringify({
        partner,
        stats: {
          clicks: clicks ?? 0,
          signups: signups ?? 0,
          paid: paid ?? 0,
          totalEarned,
          pending,
          approved,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
