// POST /functions/v1/wa-autologin  { token: string, store_id?: string }
//
// Verifies an HMAC-signed WhatsApp autologin token (issued by wa-r) and mints
// a storefront supabase session for the phone number it carries — same session
// shape phone-login returns, so the client just calls
// `supabaseStorefront.auth.setSession(...)`.
//
// This is the mechanism that lets a shopper click a WA link (order confirm,
// abandoned-cart, marketing) and land already logged-in — no OTP, no phone
// gate, and the checkout form auto-fills from their saved profile / address.

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyAutoLoginToken } from "../_shared/wa-autologin-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, store_id } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const phone = await verifyAutoLoginToken(token, serviceRoleKey);
    if (!phone) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const phoneEmail = `${phone}@phone.guest`;

    // Look up the auth user (created by any prior order / phone-login).
    let userId: string | null = null;
    const { data: existingId } = await admin.rpc("get_auth_user_id_by_email", { _email: phoneEmail });
    if (existingId && typeof existingId === "string") userId = existingId;

    // Auto-create if this phone has never touched the platform (rare — a WA
    // recipient by definition has been captured by us before).
    if (!userId) {
      const oneTime = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser } = await admin.auth.admin.createUser({
        email: phoneEmail,
        password: oneTime,
        email_confirm: true,
        user_metadata: { phone, user_type: "customer" },
      });
      userId = newUser?.user?.id ?? null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Could not resolve user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ensure storefront_customers row exists for this store so the client's
    // customer fetch resolves on the first tick (skips the phone gate).
    if (store_id && /^[0-9a-f-]{36}$/i.test(store_id)) {
      const { data: existing } = await admin.from("storefront_customers")
        .select("id").eq("user_id", userId).eq("store_id", store_id).maybeSingle();
      if (!existing) {
        await admin.from("storefront_customers").upsert(
          { user_id: userId, store_id, phone },
          { onConflict: "user_id,store_id" },
        );
      }
    }

    // Best-effort look up a saved address so the client can skip the sheet
    // even before its own lookup fires.
    let address: any = null;
    try {
      const { data: custRows } = await admin
        .from("storefront_customers")
        .select("id")
        .eq("user_id", userId)
        .limit(50);
      const custIds = (custRows || []).map((c: any) => c.id);
      if (custIds.length) {
        const { data: addrRows } = await admin
          .from("customer_addresses")
          .select("id, full_name, phone, street_address, city, state, pincode, is_default")
          .in("storefront_customer_id", custIds)
          .order("is_default", { ascending: false })
          .limit(1);
        address = addrRows?.[0] ?? null;
      }
    } catch { /* non-fatal */ }

    // Mint session via magiclink → verifyOtp (no password rotation, so the
    // user's other devices stay signed in). Mirrors phone-login.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: phoneEmail,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      return new Response(JSON.stringify({ error: "Could not mint session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: vData, error: vErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (vErr || !vData?.session) {
      return new Response(JSON.stringify({ error: "Could not verify magiclink" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      phone,
      address,
      session: {
        access_token: vData.session.access_token,
        refresh_token: vData.session.refresh_token,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
