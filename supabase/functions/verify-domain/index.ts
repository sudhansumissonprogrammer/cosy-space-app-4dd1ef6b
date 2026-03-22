import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { store_id, domain } = await req.json();

    if (!store_id || !domain) {
      return new Response(JSON.stringify({ error: "Missing store_id or domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the store's verification token
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("domain_verification_token, custom_domain")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = store.domain_verification_token;
    if (!token) {
      return new Response(JSON.stringify({ error: "No verification token found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedValue = `store-verify=${token}`;
    const cleanDomain = domain.replace(/^www\./, "");

    // Resolve TXT records using DNS over HTTPS (Cloudflare)
    const dnsUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=TXT`;
    const dnsResp = await fetch(dnsUrl, {
      headers: { Accept: "application/dns-json" },
    });
    const dnsData = await dnsResp.json();

    const txtRecords: string[] = (dnsData.Answer || [])
      .filter((r: any) => r.type === 16)
      .map((r: any) => r.data?.replace(/^"|"$/g, "").trim());

    const verified = txtRecords.some((txt) => txt === expectedValue);

    if (verified) {
      await supabase
        .from("stores")
        .update({ domain_verified: true })
        .eq("id", store_id);

      return new Response(JSON.stringify({ verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        verified: false,
        message: "TXT record not found. Please add the record and wait for DNS propagation.",
        found_records: txtRecords,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
