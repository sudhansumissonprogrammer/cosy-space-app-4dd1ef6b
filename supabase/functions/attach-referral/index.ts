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
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = (userData.user.email || "").trim().toLowerCase();

    const body = await req.json().catch(() => ({}));
    const ref = String(body?.ref ?? "").trim().toUpperCase();
    if (!/^SBP\d{2,}$/.test(ref)) {
      return new Response(JSON.stringify({ error: "invalid_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: partner } = await admin
      .from("partners")
      .select("id, user_id, status, email")
      .eq("partner_code", ref)
      .maybeSingle();

    if (!partner || partner.status !== "active") {
      return new Response(JSON.stringify({ ok: false, reason: "partner_inactive" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Self-referral guards: same user_id OR same email
    const partnerEmail = (partner.email || "").trim().toLowerCase();
    if (
      partner.user_id === userId ||
      (userEmail && partnerEmail && userEmail === partnerEmail)
    ) {
      return new Response(JSON.stringify({ ok: false, reason: "self_referral" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capture signup IP/UA for fraud review
    const signupIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;
    const signupUa = req.headers.get("user-agent") || null;

    // Check if a recent click from this same IP came from this same partner —
    // strong signal of self-referral (partner clicking own link then signing
    // up a fake account on the same network).
    let flaggedReason: string | null = null;
    if (signupIp) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: matchClicks } = await admin
        .from("partner_referral_clicks")
        .select("id")
        .eq("partner_id", partner.id)
        .eq("ip", signupIp)
        .gte("created_at", since)
        .limit(1);
      if (matchClicks && matchClicks.length > 0) {
        flaggedReason = "ip_match_partner_click";
      }
    }

    // Check existing referral — referred_user_id is UNIQUE so only one row ever
    const { data: existing } = await admin
      .from("partner_referrals")
      .select("id, partner_id, store_id")
      .eq("referred_user_id", userId)
      .maybeSingle();

    if (existing && existing.partner_id !== partner.id) {
      return new Response(JSON.stringify({ ok: false, reason: "already_attached" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let referralId = existing?.id;
    if (!existing) {
      const { data: inserted, error: insErr } = await admin
        .from("partner_referrals")
        .insert({
          partner_id: partner.id,
          referred_user_id: userId,
          status: "signup",
          signup_ip: signupIp,
          signup_user_agent: signupUa,
          flagged_reason: flaggedReason,
        })
        .select("id")
        .single();
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      referralId = inserted.id;
    }

    // Backfill: tag any existing stores owned by this user that don't yet
    // have a referring partner. The DB trigger only runs on INSERT, so stores
    // created before the code was applied need this manual update.
    const { data: stores } = await admin
      .from("stores")
      .select("id, referred_by_partner_id")
      .eq("owner_id", userId);

    const untaggedStoreIds = (stores || [])
      .filter((s: any) => !s.referred_by_partner_id)
      .map((s: any) => s.id);

    if (untaggedStoreIds.length > 0) {
      await admin
        .from("stores")
        .update({ referred_by_partner_id: partner.id })
        .in("id", untaggedStoreIds);

      // Also link the referral row to the first store if not yet linked
      if (referralId && !existing?.store_id) {
        await admin
          .from("partner_referrals")
          .update({ store_id: untaggedStoreIds[0] })
          .eq("id", referralId);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        partner_code: ref,
        backfilled_stores: untaggedStoreIds.length,
        flagged: !!flaggedReason,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
