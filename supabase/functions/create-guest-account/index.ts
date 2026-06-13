import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Create-or-resume a guest customer account from checkout.
 *
 * Identity model:
 *   - Canonical 10-digit Indian mobile → `<digits>@phone.guest` auth email.
 *   - Lookup is O(1) via SQL helper `get_auth_user_id_by_email`.
 *   - Session minting uses admin.generateLink({type:'magiclink'}) → anon.verifyOtp
 *     so the user's other devices keep their refresh tokens (no password rotation).
 *   - Existing storefront_customers rows are UPDATED with COALESCE-style guards:
 *     never clobber a name/email the customer set later in /account.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, phone, name, store_id, order_id } = await req.json();

    if (!store_id) {
      return new Response(
        JSON.stringify({ error: "store_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || (order_id && !uuidRegex.test(order_id))) {
      return new Response(
        JSON.stringify({ error: "Invalid store_id or order_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (phone && !/^[0-9\s+\-()]{7,20}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (name && (typeof name !== "string" || name.length > 200)) {
      return new Response(
        JSON.stringify({ error: "Invalid name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Canonical 10-digit Indian mobile — keep in sync with phone-login + phoneUtils.
    const rawDigits = phone.replace(/\D/g, "");
    let local = rawDigits;
    if (local.length === 13 && local.startsWith("091")) local = local.slice(3);
    else if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
    else if (local.length === 11 && local.startsWith("0")) local = local.slice(1);
    if (!(local.length === 10 && /^[6-9]/.test(local))) {
      return new Response(
        JSON.stringify({ error: "Invalid Indian mobile number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const normalizedPhone = local;
    const phoneEmail = `${normalizedPhone}@phone.guest`;
    const realEmail = email ? email.toLowerCase().trim() : null;

    // 1) O(1) lookup
    let userId: string | null = null;
    let isNewUser = false;
    const { data: existingId } = await supabase
      .rpc("get_auth_user_id_by_email", { _email: phoneEmail });
    if (existingId && typeof existingId === "string") userId = existingId;

    // 2) Create if missing
    if (!userId) {
      const oneTimePassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: phoneEmail,
        password: oneTimePassword,
        email_confirm: true,
        user_metadata: {
          full_name: name || null,
          phone: normalizedPhone,
          contact_email: realEmail,
          user_type: "customer",
        },
      });
      if (newUser?.user) {
        userId = newUser.user.id;
        isNewUser = true;
      } else {
        const code = (createErr as any)?.code || "";
        const msg = (createErr?.message || "").toLowerCase();
        const isDuplicate =
          code === "email_exists" ||
          msg.includes("already been registered") ||
          msg.includes("already registered") ||
          msg.includes("already") ||
          msg.includes("exists");
        if (isDuplicate) {
          const { data: id2 } = await supabase
            .rpc("get_auth_user_id_by_email", { _email: phoneEmail });
          if (id2 && typeof id2 === "string") userId = id2;
        }
        if (!userId) {
          console.error("Create user error:", createErr);
          return new Response(
            JSON.stringify({ error: createErr?.message || "Could not create user" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 3) Upsert storefront_customers — COALESCE-style: never clobber saved fields.
    const { data: existingCustomer } = await supabase
      .from("storefront_customers")
      .select("id, name, email, phone")
      .eq("user_id", userId)
      .eq("store_id", store_id)
      .maybeSingle();

    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      const patch: Record<string, unknown> = {};
      // Phone is the identity key — always keep it canonical.
      if (existingCustomer.phone !== normalizedPhone) patch.phone = normalizedPhone;
      // Only fill name/email when currently empty. Never overwrite a user-saved value.
      if (!existingCustomer.name && name) patch.name = name;
      if (!existingCustomer.email && realEmail) patch.email = realEmail;
      if (Object.keys(patch).length > 0) {
        await supabase.from("storefront_customers").update(patch).eq("id", customerId);
      }
    } else {
      const { data: newCustomer, error: insertErr } = await supabase
        .from("storefront_customers")
        .insert({
          user_id: userId,
          store_id,
          email: realEmail,
          name: name || null,
          phone: normalizedPhone,
        })
        .select("id")
        .single();
      if (insertErr || !newCustomer) {
        console.error("Insert customer error:", insertErr);
        return new Response(
          JSON.stringify({ error: insertErr?.message || "Could not create customer" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      customerId = newCustomer.id;
    }

    // 4) Link order to customer (also auto-handled by DB trigger, kept for completeness).
    if (order_id) {
      await supabase
        .from("orders")
        .update({ storefront_customer_id: customerId })
        .eq("id", order_id);

      const { data: orderData } = await supabase
        .from("orders")
        .select("street_address, city, state, pincode, customer_name, customer_phone")
        .eq("id", order_id)
        .single();

      if (orderData?.street_address) {
        const { data: existingAddr } = await supabase
          .from("customer_addresses")
          .select("id")
          .eq("storefront_customer_id", customerId)
          .limit(1)
          .maybeSingle();

        if (!existingAddr) {
          await supabase.from("customer_addresses").insert({
            storefront_customer_id: customerId,
            label: "Home",
            full_name: orderData.customer_name || name || null,
            phone: orderData.customer_phone || normalizedPhone || null,
            street_address: orderData.street_address,
            city: orderData.city,
            state: orderData.state,
            pincode: orderData.pincode,
            is_default: true,
          });
        }
      }
    }

    // 5) Mint session WITHOUT rotating password.
    const session = await mintSession(supabase, anonClient, phoneEmail, userId);

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: customerId,
        is_new_user: isNewUser,
        session,
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
 * Mint a session WITHOUT changing the user's password.
 * Uses admin.generateLink({type:'magiclink'}) → anon.verifyOtp.
 * Falls back to a password rotation only if the magic-link path fails.
 */
async function mintSession(
  admin: any,
  anon: any,
  email: string,
  userId: string
): Promise<{ access_token: string; refresh_token: string } | null> {
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
      console.warn("[create-guest-account] verifyOtp failed, falling back:", vErr?.message);
    } else {
      console.warn("[create-guest-account] generateLink failed, falling back:", linkErr?.message);
    }
  } catch (e) {
    console.warn("[create-guest-account] magiclink mint threw:", (e as Error).message);
  }

  // Fallback: rotate password (legacy) — only on magic-link failure.
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
