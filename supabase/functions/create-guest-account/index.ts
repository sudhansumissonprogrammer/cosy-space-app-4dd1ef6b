import { createClient } from "npm:@supabase/supabase-js@2";
import { mintUserSession } from "../_shared/auth-session-mint.ts";

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
    const { email, phone, name, store_id, order_id, address_only } = await req.json();

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

    // ⚡ FAST PATH (address_only): the checkout UI blocks its address gate on
    // this call, so it must be instant. Skip auth user creation, customer
    // upsert, address seeding and session minting — just answer "does this
    // phone have a deliverable address on file?" with 2 parallel reads.
    // The heavy full call still runs in the background from the client.
    if (address_only) {
      const mapAddr = (row: any) => {
        if (!String(row?.street_address || "").trim() || !row?.pincode) return null;
        return {
          id: row.id ?? null,
          label: row.label ?? "Home",
          full_name: row.full_name ?? row.customer_name ?? name ?? null,
          phone: row.phone ?? row.customer_phone ?? normalizedPhone,
          street_address: row.street_address,
          city: row.city ?? null,
          state: row.state ?? null,
          pincode: row.pincode,
          is_default: row.is_default ?? true,
        };
      };

      const [{ data: phoneCustomers }, { data: lastOrder }] = await Promise.all([
        supabase.from("storefront_customers").select("id").eq("phone", normalizedPhone).limit(50),
        supabase
          .from("orders")
          .select("street_address, city, state, pincode, customer_name, customer_phone, created_at")
          .eq("customer_phone", normalizedPhone)
          .not("street_address", "is", null)
          .not("pincode", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      let fastAddress: any = null;
      const ids = (phoneCustomers || []).map((c: any) => c.id).filter(Boolean);
      if (ids.length > 0) {
        const { data: savedAddr } = await supabase
          .from("customer_addresses")
          .select("id, label, full_name, phone, street_address, city, state, pincode, is_default, created_at")
          .in("storefront_customer_id", ids)
          .not("street_address", "is", null)
          .not("pincode", "is", null)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        fastAddress = mapAddr(savedAddr);
      }
      if (!fastAddress) fastAddress = mapAddr(lastOrder);

      return new Response(
        JSON.stringify({ success: true, fast: true, address: fastAddress }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    //    Unique index (user_id, store_id) blocks duplicate-row races.
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
      if (existingCustomer.phone !== normalizedPhone) patch.phone = normalizedPhone;
      if (!existingCustomer.name && name) patch.name = name;
      if (!existingCustomer.email && realEmail) patch.email = realEmail;
      if (Object.keys(patch).length > 0) {
        await supabase.from("storefront_customers").update(patch).eq("id", customerId);
      }
    } else {
      const { data: newCustomer, error: insertErr } = await supabase
        .from("storefront_customers")
        .upsert(
          {
            user_id: userId,
            store_id,
            email: realEmail,
            name: name || null,
            phone: normalizedPhone,
          },
          { onConflict: "user_id,store_id" }
        )
        .select("id")
        .single();
      if (insertErr || !newCustomer) {
        console.error("Upsert customer error:", insertErr);
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
    }

    // 4b) Hydrate + seed customer_addresses so returning shoppers
    //     (even on a NEW browser / new store) skip the address form entirely.
    //     Priority:
    //       1) current-store saved address,
    //       2) ANY saved address attached to this phone across all stores,
    //       3) latest paid/confirmed order address across all stores,
    //       4) latest order address as a last resort.
    let hydratedAddress: {
      id?: string | null;
      label?: string | null;
      full_name: string | null;
      phone: string | null;
      street_address: string;
      city: string | null;
      state: string | null;
      pincode: string;
      is_default?: boolean | null;
    } | null = null;

    const toAddressPayload = (row: any) => {
      if (!String(row?.street_address || "").trim() || !row?.pincode) return null;
      return {
        id: row.id ?? null,
        label: row.label ?? "Home",
        full_name: row.full_name ?? row.customer_name ?? name ?? null,
        phone: row.phone ?? row.customer_phone ?? normalizedPhone ?? null,
        street_address: row.street_address,
        city: row.city ?? null,
        state: row.state ?? null,
        pincode: row.pincode,
        is_default: row.is_default ?? true,
      };
    };

    try {
      const { data: existingAddr } = await supabase
        .from("customer_addresses")
        .select("id, label, full_name, phone, street_address, city, state, pincode, is_default, created_at")
        .eq("storefront_customer_id", customerId)
        .not("street_address", "is", null)
        .not("pincode", "is", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      hydratedAddress = toAddressPayload(existingAddr);

      if (!hydratedAddress) {
        // Saved address in another store for the same canonical phone.
        const { data: phoneCustomers } = await supabase
          .from("storefront_customers")
          .select("id")
          .eq("phone", normalizedPhone)
          .limit(50);

        const customerIds = (phoneCustomers || [])
          .map((c: any) => c.id)
          .filter((id: string | null | undefined): id is string => !!id);

        if (customerIds.length > 0) {
          const { data: anySavedAddr } = await supabase
            .from("customer_addresses")
            .select("id, label, full_name, phone, street_address, city, state, pincode, is_default, created_at")
            .in("storefront_customer_id", customerIds)
            .not("street_address", "is", null)
            .not("pincode", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          hydratedAddress = toAddressPayload(anySavedAddr);
        }
      }

      if (!hydratedAddress) {
        let seedFrom: any | null = null;

        if (order_id) {
          const { data } = await supabase
            .from("orders")
            .select("street_address, city, state, pincode, customer_name, customer_phone")
            .eq("id", order_id)
            .maybeSingle();
          if (data?.street_address) seedFrom = data as any;
        }

        if (!seedFrom) {
          // Prefer paid/confirmed history so cancelled/pending test addresses
          // don't overwrite a real delivery address.
          const paidStatuses = ["paid", "confirmed", "partially_paid", "delivered", "completed", "shipped"];
          const { data } = await supabase
            .from("orders")
            .select("street_address, city, state, pincode, customer_name, customer_phone, created_at, status")
            .eq("customer_phone", normalizedPhone)
            .in("status", paidStatuses)
            .not("street_address", "is", null)
            .not("pincode", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data?.street_address) seedFrom = data as any;
        }

        if (!seedFrom) {
          const { data } = await supabase
            .from("orders")
            .select("street_address, city, state, pincode, customer_name, customer_phone, created_at, status")
            .eq("customer_phone", normalizedPhone)
            .not("street_address", "is", null)
            .not("pincode", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data?.street_address) seedFrom = data as any;
        }

        hydratedAddress = toAddressPayload(seedFrom);
      }

      if (!existingAddr && hydratedAddress?.street_address && hydratedAddress?.pincode) {
        const { data: insertedAddress } = await supabase
          .from("customer_addresses")
          .insert({
            storefront_customer_id: customerId,
            label: hydratedAddress.label || "Home",
            full_name: hydratedAddress.full_name || name || null,
            phone: hydratedAddress.phone || normalizedPhone || null,
            street_address: hydratedAddress.street_address,
            city: hydratedAddress.city,
            state: hydratedAddress.state,
            pincode: hydratedAddress.pincode,
            is_default: true,
          })
          .select("id, label, full_name, phone, street_address, city, state, pincode, is_default")
          .maybeSingle();
        hydratedAddress = toAddressPayload(insertedAddress) || hydratedAddress;
      }
    } catch (seedErr) {
      console.warn("Address seed skipped:", seedErr);
    }

    // 5) Mint session WITHOUT rotating password.
    const session = await mintUserSession(supabase, anonClient, userId, phoneEmail, "create-guest-account");
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not create session" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: customerId,
        is_new_user: isNewUser,
        address: hydratedAddress,
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

