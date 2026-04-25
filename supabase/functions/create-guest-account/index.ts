import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, phone, name, store_id, order_id } = await req.json();

    // Validate required fields (order_id is now optional — phone-only login at quick-buy time)
    if (!store_id) {
      return new Response(
        JSON.stringify({ error: "store_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(store_id) || (order_id && !uuidRegex.test(order_id))) {
      return new Response(
        JSON.stringify({ error: "Invalid store_id or order_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format if provided (digits, spaces, +, -, parens only)
    if (phone && !/^[0-9\s+\-()]{7,20}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate name length
    if (name && (typeof name !== "string" || name.length > 200)) {
      return new Response(
        JSON.stringify({ error: "Invalid name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phone is required as primary identifier
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Phone is the PRIMARY identifier. Always use phone-based pseudo-email for auth uniqueness.
    // Real email (if provided) is stored on storefront_customers for communication only.
    const normalizedPhone = phone.replace(/[^0-9]/g, "");
    const phoneEmail = `${normalizedPhone}@phone.guest`;
    const realEmail = email ? email.toLowerCase().trim() : null;
    const normalizedEmail = phoneEmail; // for downstream session generation

    // Lookup existing user by phone-based email (primary key)
    // Find existing user by paginating (listUsers default = 50 per page)
    let existingUser: any = null;
    for (let page = 1; page <= 20; page++) {
      const { data, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (listErr) break;
      const found = data?.users?.find((u) => u.email?.toLowerCase() === phoneEmail);
      if (found) { existingUser = found; break; }
      if (!data?.users || data.users.length < 1000) break;
    }

    let userId: string;
    let generatedPassword: string | null = null;
    let isNewUser = false;

    const resetExisting = async (id: string) => {
      generatedPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      await supabase.auth.admin.updateUserById(id, { password: generatedPassword });
    };

    if (existingUser) {
      userId = existingUser.id;
      await resetExisting(userId);
    } else {
      // Create a new user keyed by phone, with a random password (they can reset later)
      generatedPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: phoneEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: name || null,
          phone: normalizedPhone,
          contact_email: realEmail,
          user_type: "customer",
        },
      });

      if (createErr) {
        // Race / pagination miss: user already exists. Look them up and reset password.
        const code = (createErr as any).code || "";
        const msg = (createErr.message || "").toLowerCase();
        if (code === "email_exists" || msg.includes("already been registered") || msg.includes("already registered")) {
          let foundUser: any = null;
          for (let page = 1; page <= 50; page++) {
            const { data, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (listErr) break;
            const f = data?.users?.find((u) => u.email?.toLowerCase() === phoneEmail);
            if (f) { foundUser = f; break; }
            if (!data?.users || data.users.length < 1000) break;
          }
          if (!foundUser) {
            console.error("Create user error (could not locate existing):", createErr);
            return new Response(
              JSON.stringify({ error: createErr.message }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          userId = foundUser.id;
          await resetExisting(userId);
        } else {
          console.error("Create user error:", createErr);
          return new Response(
            JSON.stringify({ error: createErr.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        userId = newUser.user.id;
        isNewUser = true;
      }
    }

    // Upsert storefront_customer
    const { data: existingCustomer } = await supabase
      .from("storefront_customers")
      .select("id")
      .eq("user_id", userId)
      .eq("store_id", store_id)
      .maybeSingle();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabase
        .from("storefront_customers")
        .update({
          name: name || undefined,
          phone: normalizedPhone,
          email: realEmail || undefined,
        })
        .eq("id", customerId);
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

      if (insertErr) {
        console.error("Insert customer error:", insertErr);
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      customerId = newCustomer.id;
    }

    // Link order to customer (only if an order was provided)
    if (order_id) {
      await supabase
        .from("orders")
        .update({ storefront_customer_id: customerId })
        .eq("id", order_id);

      // Save address from order to customer_addresses if not exists
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
            phone: orderData.customer_phone || phone || null,
            street_address: orderData.street_address,
            city: orderData.city,
            state: orderData.state,
            pincode: orderData.pincode,
            is_default: true,
          });
        }
      }
    }

    // Generate a session for auto-login (works for both new and returning users since we (re)set the password)
    let session = null;
    if (generatedPassword) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
        email: normalizedEmail,
        password: generatedPassword,
      });

      if (!signInErr && signInData?.session) {
        session = {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        };
      } else if (signInErr) {
        console.error("Auto-login signIn error:", signInErr);
      }
    }

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
