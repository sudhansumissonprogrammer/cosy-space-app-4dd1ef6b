import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results: Record<string, number> = {};

    // 1. Delete page_views older than 7 days
    const { count: pvCount } = await supabase
      .from("page_views")
      .delete({ count: "exact" })
      .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    results.page_views_deleted = pvCount ?? 0;

    // 2. Delete abandoned_carts older than 7 days (unrecovered only)
    const { count: acCount } = await supabase
      .from("abandoned_carts")
      .delete({ count: "exact" })
      .eq("recovered", false)
      .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    results.abandoned_carts_deleted = acCount ?? 0;

    // 3. Delete email_send_log older than 14 days
    const { count: elCount } = await supabase
      .from("email_send_log")
      .delete({ count: "exact" })
      .lt("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
    results.email_send_log_deleted = elCount ?? 0;

    // 4. Delete whatsapp_messages older than 30 days
    const { count: wmCount } = await supabase
      .from("whatsapp_messages")
      .delete({ count: "exact" })
      .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    results.whatsapp_messages_deleted = wmCount ?? 0;

    console.log("[db-cleanup] Results:", results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[db-cleanup] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
