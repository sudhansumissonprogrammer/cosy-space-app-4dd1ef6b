// Cron endpoint: moves pending commissions older than hold_days into approved.
// Called daily by pg_cron via net.http_post.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: settings } = await admin.from("partner_settings").select("hold_days").limit(1).maybeSingle();
    const holdDays = Number(settings?.hold_days ?? 14);
    const cutoff = new Date(Date.now() - holdDays * 86400_000).toISOString();

    const { data: due } = await admin
      .from("partner_commissions")
      .select("id, payment_id")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .limit(500);

    let approved = 0;
    let skipped = 0;
    for (const c of due ?? []) {
      // Verify the underlying payment is still paid
      if (c.payment_id) {
        const { data: pmt } = await admin.from("subscription_payments")
          .select("status").eq("id", c.payment_id).maybeSingle();
        if (!pmt || pmt.status !== "paid") { skipped++; continue; }
      }
      const { data: ok } = await admin.rpc("wallet_approve_commission", { _commission_id: c.id });
      if (ok) approved++;
    }

    return new Response(JSON.stringify({ ok: true, hold_days: holdDays, scanned: due?.length ?? 0, approved, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
