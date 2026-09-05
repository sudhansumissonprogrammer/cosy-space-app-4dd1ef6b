// POST /functions/v1/wa-autologin  { token: string, store_id?: string }
//
// Verifies an HMAC-signed WhatsApp autologin token (issued by wa-r) and mints
// a storefront supabase session for the phone it carries.
//
// Consolidated data hop:
//   `wa_autologin_bundle(_phone, _store_id)` returns { user_id, address,
//   ensured_customer } in ONE round trip — collapses the previous 3 sequential
//   queries (user lookup → customer upsert → address fetch).
//
// This function is the FALLBACK path: wa-r now pre-mints the session and
// passes it via URL fragment for zero-RTT autologin. wa-autologin still runs
// when the pre-mint budget expired (slow auth API) or for older link formats.

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
    const storeIdArg = (store_id && /^[0-9a-f-]{36}$/i.test(store_id)) ? store_id : null;

    // Single-hop bundle: user_id + address + upsert customer row.
    let userId: string | null = null;
    let address: any = null;
    try {
      const { data: bundle } = await admin.rpc("wa_autologin_bundle", {
        _phone: phone,
        _store_id: storeIdArg,
      });
      const b = bundle as any;
      if (b && typeof b === "object") {
        userId = b.user_id ?? null;
        address = b.address ?? null;
      }
    } catch { /* fall through — bundle may not exist on old deployments */ }

    // Auto-create the auth user if this phone has never touched the platform.
    // Rare — a WA recipient by definition has been captured by us before.
    if (!userId) {
      const oneTime = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser } = await admin.auth.admin.createUser({
        email: phoneEmail,
        password: oneTime,
        email_confirm: true,
        user_metadata: { phone, user_type: "customer" },
      });
      userId = newUser?.user?.id ?? null;

      // Concurrent request for the same phone → duplicate-email failure.
      // Re-look-up the existing account instead of erroring out.
      for (let attempt = 0; attempt < 3 && !userId; attempt++) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
        try {
          const { data: existing } = await admin.rpc("get_auth_user_id_by_email", { _email: phoneEmail });
          if (existing && typeof existing === "string") userId = existing;
        } catch { /* ignore */ }
      }


      // Re-run the bundle so we upsert the customer row + get the address for
      // this brand-new user. Address will typically be null (new shopper).
      if (userId && storeIdArg) {
        try {
          const { data: bundle2 } = await admin.rpc("wa_autologin_bundle", {
            _phone: phone,
            _store_id: storeIdArg,
          });
          const b2 = bundle2 as any;
          if (b2?.address) address = b2.address;
        } catch { /* non-fatal */ }
      }
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Could not resolve user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mint session via magiclink → verifyOtp (no password rotation, so the
    // user's other devices stay signed in). Mirrors phone-login.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: phoneEmail,
    });
    const tokenHash = (linkData as any)?.properties?.hashed_token;
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
