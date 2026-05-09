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
      .select("id, user_id, status")
      .eq("partner_code", ref)
      .maybeSingle();

    if (!partner || partner.status !== "active") {
      return new Response(JSON.stringify({ ok: false, reason: "partner_inactive" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-referral
    if (partner.user_id === userId) {
      return new Response(JSON.stringify({ ok: false, reason: "self_referral" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
