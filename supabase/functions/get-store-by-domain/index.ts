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
  const storeFromQuery = url.searchParams.get("store");
  const domain = url.searchParams.get("domain");

  // If ?store=slug is provided, use it directly as the slug
  if (storeFromQuery) {
    return new Response(JSON.stringify({ slug: storeFromQuery }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Otherwise resolve slug from hostname/domain
  const hostname = domain || url.searchParams.get("hostname");
  const slug = hostname ? hostname.split(".")[0] : null;

  if (!hostname) {
    return new Response(JSON.stringify({ slug: null, error: "Missing store or domain param" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // First try custom_domain exact match
  const { data: customDomainData } = await supabase
    .from("stores")
    .select("slug")
    .eq("custom_domain", hostname)
    .eq("is_suspended", false)
    .maybeSingle();

  if (customDomainData?.slug) {
    return new Response(JSON.stringify({ slug: customDomainData.slug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fallback: extract subdomain as slug
  const { data, error } = await supabase
    .from("stores")
    .select("slug")
    .eq("slug", slug)
    .eq("is_suspended", false)
    .maybeSingle();

  return new Response(JSON.stringify({ slug: data?.slug || null }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
