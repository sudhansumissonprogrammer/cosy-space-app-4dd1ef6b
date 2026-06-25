import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCors } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { store_id, domain } = await req.json();

    if (!store_id || !domain) {
      return new Response(JSON.stringify({ error: "Missing store_id or domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ownership check: caller must own the store OR be an admin.
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("domain_verification_token, custom_domain, owner_id")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (store.owner_id !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const verifyToken = store.domain_verification_token;
    if (!verifyToken) {
      return new Response(JSON.stringify({ error: "No verification token found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedValue = `store-verify=${verifyToken}`;
    const cleanDomain = String(domain).replace(/^www\./, "");

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
