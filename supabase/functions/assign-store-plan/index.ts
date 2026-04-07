import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Backend configuration is missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { storeId, planId } = await req.json();
    if (!storeId || !planId) {
      return new Response(JSON.stringify({ error: "storeId and planId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: store, error: storeError } = await adminClient
      .from("stores")
      .select("id, owner_id")
      .eq("id", storeId)
      .maybeSingle();

    if (storeError) throw storeError;
    if (!store) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (store.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "You can only assign plans to your own store" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan, error: planError } = await adminClient
      .from("plans")
      .select("id")
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) {
      return new Response(JSON.stringify({ error: "Selected plan is not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingAssignment, error: existingError } = await adminClient
      .from("store_plan_assignments")
      .select("id, store_id, plan_id, status")
      .eq("store_id", storeId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingAssignment) {
      return new Response(JSON.stringify({ data: existingAssignment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: assignment, error: assignmentError } = await adminClient
      .from("store_plan_assignments")
      .insert({
        store_id: storeId,
        plan_id: planId,
        status: "active",
      })
      .select("id, store_id, plan_id, status")
      .single();

    if (assignmentError) throw assignmentError;

    return new Response(JSON.stringify({ data: assignment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to assign store plan";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});