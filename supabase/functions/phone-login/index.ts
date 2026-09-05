import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Direct phone login (NO OTP, NO password rotation).
 *
 * Flow:
 *  1. Canonicalize phone → 10-digit → email `<digits>@phone.guest`.
 *  2. Look up auth user via RPC `get_auth_user_id_by_email` (O(1)).
 *     If missing, `admin.createUser` once with a one-time random password.
 *  3. Mint a session WITHOUT touching the password by calling
 *     `admin.generateLink({ type: 'magiclink' })` and exchanging the returned
 *     `hashed_token` via anon `auth.verifyOtp({ type: 'magiclink', token_hash })`.
 *     This preserves refresh tokens on the user's other devices.
 *  4. Fallback: if generateLink fails, rotate password + signInWithPassword.
 *  5. Ensure storefront_customers row + optional claim of a fresh order.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, store_id, name, claim_order_id } = await req.json();

    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^[0-9\s+\-()]{7,20}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Canonical 10-digit Indian mobile — single source of truth across the
    // stack. Mirror of src/lib/phoneUtils.ts (toCanonicalIndianPhone) and
    // supabase/functions/create-guest-account/index.ts.
    const rawDigits = phone.replace(/\D/g, "");
    let local = rawDigits;
    if (local.length === 13 && local.startsWith("091")) local = local.slice(3);
    else if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
    else if (local.length === 11 && local.startsWith("0")) local = local.slice(1);
    if (!(local.length === 10 && /^[6-9]/.test(local))) {
      return new Response(
        JSON.stringify({ error: "Enter a valid 10-digit Indian mobile number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const normalizedPhone = local;
    const phoneEmail = `${normalizedPhone}@phone.guest`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string | null = null;
    let isNewUser = false;

    // 1) O(1) lookup via SQL helper
    const { data: existingId } = await adminClient
      .rpc("get_auth_user_id_by_email", { _email: phoneEmail });
    if (existingId && typeof existingId === "string") {
      userId = existingId;
    }

    // 2) Create if missing
    if (!userId) {
      const oneTimePassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: phoneEmail,
        password: oneTimePassword,
        email_confirm: true,
        user_metadata: {
          full_name: name || null,
          phone: normalizedPhone,
          user_type: "customer",
        },
      });
      if (newUser?.user) {
        userId = newUser.user.id;
        isNewUser = true;
      } else {
        // ANY createUser failure can be a concurrent-signup race. GoTrue often
        // surfaces the duplicate as a generic "Database error creating new
        // user" (unique violation on users_email_partial_key), so we never
        // rely on the message — we simply re-look-up the account, with a short
        // retry to cover replication/commit lag of the winning request.
        for (let attempt = 0; attempt < 3 && !userId; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 150 * attempt));
          const { data: id2 } = await adminClient
            .rpc("get_auth_user_id_by_email", { _email: phoneEmail });
          if (id2 && typeof id2 === "string") userId = id2;
        }
        if (!userId) {
          console.error("[phone-login] createUser failed:", createErr?.message);
          return new Response(
            JSON.stringify({ error: createErr?.message || "Could not create user" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

    }

    // 3) Ensure storefront_customers row exists for this store (if given).
    //    Uses upsert on (user_id, store_id) — the unique index blocks the race
    //    between concurrent phone-login + create-guest-account calls.
    //    Also patches `name` when it was previously empty (never clobbers a
    //    user-saved value, mirroring create-guest-account COALESCE-style).
    let storefrontCustomerId: string | null = null;
    if (store_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(store_id)) {
      const { data: existingCustomer } = await adminClient
        .from("storefront_customers")
        .select("id, name, phone")
        .eq("user_id", userId)
        .eq("store_id", store_id)
        .maybeSingle();

      if (existingCustomer) {
        storefrontCustomerId = existingCustomer.id;
        const patch: Record<string, unknown> = {};
        if (existingCustomer.phone !== normalizedPhone) patch.phone = normalizedPhone;
        if (!existingCustomer.name && name) patch.name = name;
        if (Object.keys(patch).length > 0) {
          await adminClient.from("storefront_customers").update(patch).eq("id", existingCustomer.id);
        }
      } else {
        const { data: created } = await adminClient
          .from("storefront_customers")
          .upsert(
            { user_id: userId, store_id, phone: normalizedPhone, name: name || null },
            { onConflict: "user_id,store_id" }
          )
          .select("id")
          .single();
        storefrontCustomerId = created?.id ?? null;
      }
    }

    // 4) Optional: claim a guest order placed seconds ago.
    if (
      claim_order_id &&
      storefrontCustomerId &&
      store_id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claim_order_id)
    ) {
      try {
        const { data: order } = await adminClient
          .from("orders")
          .select("id, customer_phone, store_id, storefront_customer_id")
          .eq("id", claim_order_id)
          .maybeSingle();
        if (order && order.store_id === store_id && !order.storefront_customer_id) {
          const orderPhoneDigits = (order.customer_phone || "").replace(/\D/g, "");
          const matches =
            orderPhoneDigits.endsWith(normalizedPhone) ||
            normalizedPhone.endsWith(orderPhoneDigits);
          if (matches && orderPhoneDigits.length >= 10) {
            await adminClient
              .from("orders")
              .update({ storefront_customer_id: storefrontCustomerId })
              .eq("id", claim_order_id);
          }
        }
      } catch (_e) {
        // non-fatal
      }
    }

    // 5) Mint a session WITHOUT rotating password (preserves other devices).
    const session = await mintSession(adminClient, anonClient, phoneEmail, userId);
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Could not create session" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        is_new_user: isNewUser,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Mint a session for an existing user WITHOUT changing their password.
 * Uses admin.generateLink({type:'magiclink'}) → anon.verifyOtp.
 *
 * IMPORTANT: if generateLink is rate-limited (429 / "rate limit"), we do NOT
 * fall back to password rotation — that would invalidate every existing
 * refresh token on the user's other devices (the exact bug we just fixed).
 * We only fall back to password rotation on hard, non-rate-limit errors.
 */
async function mintSession(
  admin: any,
  anon: any,
  email: string,
  userId: string
): Promise<{ access_token: string; refresh_token: string } | null> {
  let rateLimited = false;
  try {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (!linkErr && tokenHash) {
      const { data: vData, error: vErr } = await anon.auth.verifyOtp({
        type: "magiclink",
        token_hash: tokenHash,
      });
      if (!vErr && vData?.session) {
        return {
          access_token: vData.session.access_token,
          refresh_token: vData.session.refresh_token,
        };
      }
      console.warn("[phone-login] verifyOtp failed:", vErr?.message);
    } else {
      const msg = (linkErr?.message || "").toLowerCase();
      const status = (linkErr as any)?.status;
      rateLimited =
        status === 429 ||
        msg.includes("rate limit") ||
        msg.includes("too many") ||
        msg.includes("over_email_send_rate_limit");
      console.warn("[phone-login] generateLink failed:", linkErr?.message, "rateLimited=", rateLimited);
    }
  } catch (e) {
    console.warn("[phone-login] magiclink mint threw:", (e as Error).message);
  }

  // Rate-limited: bail out instead of rotating password. The caller's
  // existing session (if any) stays valid; UI shows a soft retry message.
  if (rateLimited) return null;

  // Fallback (non-rate-limit failures only): rotate password.
  try {
    const freshPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: freshPassword,
    });
    if (updErr) return null;
    const { data: sData, error: sErr } = await anon.auth.signInWithPassword({
      email,
      password: freshPassword,
    });
    if (sErr || !sData?.session) return null;
    return {
      access_token: sData.session.access_token,
      refresh_token: sData.session.refresh_token,
    };
  } catch {
    return null;
  }
}
