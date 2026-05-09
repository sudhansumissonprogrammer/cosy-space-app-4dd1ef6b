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

    const { data: partner } = await admin
      .from("partners").select("id, partner_code, name, status, commission_percentage")
      .eq("user_id", userData.user.id).maybeSingle();
    if (!partner) return json({ partner: null }, 200);

    const [walletRes, ledgerRes, withdrawalsRes, notifRes, settingsRes] = await Promise.all([
      admin.from("partner_wallets").select("*").eq("partner_id", partner.id).maybeSingle(),
      admin.from("partner_wallet_ledger").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(50),
      admin.from("partner_withdrawals").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(50),
      admin.from("partner_notifications").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(20),
      admin.from("partner_settings").select("minimum_withdrawal,hold_days").limit(1).maybeSingle(),
    ]);

    const wallet = walletRes.data ?? { partner_id: partner.id, pending: 0, approved: 0, paid: 0, locked: 0 };
    const withdrawable = Number(wallet.approved || 0);

    return json({
      partner,
      wallet: {
        pending: Number(wallet.pending || 0),
        approved: Number(wallet.approved || 0),
        locked: Number(wallet.locked || 0),
        paid: Number(wallet.paid || 0),
        withdrawable,
      },
      ledger: ledgerRes.data ?? [],
      withdrawals: withdrawalsRes.data ?? [],
      notifications: notifRes.data ?? [],
      settings: {
        minimum_withdrawal: Number(settingsRes.data?.minimum_withdrawal ?? 500),
        hold_days: Number(settingsRes.data?.hold_days ?? 14),
      },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
