import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");

  if (!domain) {
    return new Response(JSON.stringify({ slug: null, error: "Missing domain param" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("stores")
    .select("slug")
    .eq("custom_domain", domain)
    .eq("is_suspended", false)
    .maybeSingle();

  return new Response(JSON.stringify({ slug: data?.slug || null }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
