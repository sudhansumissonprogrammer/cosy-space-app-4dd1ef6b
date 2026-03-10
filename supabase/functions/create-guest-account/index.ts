import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    if (!email || !store_id || !order_id) {
      return new Response(
        JSON.stringify({ error: "email, store_id and order_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user already exists with this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create a new user with a random password (they can reset later)
      const randomPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: randomPassword,
        email_confirm: true,
        user_metadata: { full_name: name || null },
      });

      if (createErr) {
        console.error("Create user error:", createErr);
        return new Response(
          JSON.stringify({ error: createErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = newUser.user.id;
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
      // Update name/phone if provided
      await supabase
        .from("storefront_customers")
        .update({
          name: name || undefined,
          phone: phone || undefined,
          email: email.toLowerCase().trim(),
        })
        .eq("id", customerId);
    } else {
      const { data: newCustomer, error: insertErr } = await supabase
        .from("storefront_customers")
        .insert({
          user_id: userId,
          store_id,
          email: email.toLowerCase().trim(),
          name: name || null,
          phone: phone || null,
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

    // Link order to customer
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

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: customerId,
        is_new_user: !existingUser,
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
