import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Direct phone login (NO OTP).
 *
 * Behavior:
 * - Looks up an auth user keyed by `${normalizedPhone}@phone.guest`
 *   (the same scheme used by create-guest-account).
 * - If found, resets that user's password to a fresh random value and
 *   returns a real session (access + refresh tokens) for auto-login.
 * - If not found, creates a new user keyed by phone + creates a
 *   storefront_customers row for the given store, then signs in.
 *
 * The client takes the returned tokens and calls supabase.auth.setSession(...)
 * to log the user in immediately.
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

    const normalizedPhone = phone.replace(/[^0-9]/g, "");
    if (normalizedPhone.length < 7) {
      return new Response(
        JSON.stringify({ error: "Phone number too short" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneEmail = `${normalizedPhone}@phone.guest`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate a fresh password each time so login is deterministic
    const freshPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
    let userId: string;
    let isNewUser = false;

    // Try to create the user first. If it already exists, fall back to update.
    // This avoids the unreliable listUsers() pagination scan.
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: phoneEmail,
      password: freshPassword,
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
      // User likely already exists — find them by paginating listUsers
      const errMsg = createErr?.message?.toLowerCase() || "";
      const isDuplicate =
        errMsg.includes("already") ||
        errMsg.includes("registered") ||
        errMsg.includes("exists") ||
        (createErr as any)?.code === "email_exists";

      if (!isDuplicate && createErr) {
        return new Response(
          JSON.stringify({ error: createErr.message || "Could not create user" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Paginate through users to find the matching one
      let foundUser: { id: string } | null = null;
      for (let page = 1; page <= 20 && !foundUser; page++) {
        const { data: list } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
        if (!list?.users?.length) break;
        const match = list.users.find((u) => u.email?.toLowerCase() === phoneEmail);
        if (match) foundUser = { id: match.id };
        if (list.users.length < 200) break;
      }

      if (!foundUser) {
        return new Response(
          JSON.stringify({ error: "Account exists but could not be located. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = foundUser.id;
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
        password: freshPassword,
        email_confirm: true,
      });
      if (updateErr) {
        return new Response(
          JSON.stringify({ error: updateErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Ensure a storefront_customers row exists for this store (if store_id given)
    let storefrontCustomerId: string | null = null;
    if (store_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(store_id)) {
      const { data: existingCustomer } = await adminClient
        .from("storefront_customers")
        .select("id")
        .eq("user_id", userId)
        .eq("store_id", store_id)
        .maybeSingle();

      if (existingCustomer) {
        storefrontCustomerId = existingCustomer.id;
      } else {
        const { data: created } = await adminClient.from("storefront_customers").insert({
          user_id: userId,
          store_id,
          phone: normalizedPhone,
          name: name || null,
        }).select("id").single();
        storefrontCustomerId = created?.id ?? null;
      }
    }

    // Optionally claim a guest order placed seconds ago — verify the order's
    // customer_phone matches the phone we just authenticated, then link it to
    // the storefront customer so it shows up in /account.
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
          // Match either exact 10-digit or with country-code suffix
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
        // non-fatal — login should still succeed
      }
    }

    // Sign in to mint a real session
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: phoneEmail,
      password: freshPassword,
    });

    if (signInErr || !signInData?.session) {
      return new Response(
        JSON.stringify({ error: signInErr?.message || "Could not create session" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        is_new_user: isNewUser,
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
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
