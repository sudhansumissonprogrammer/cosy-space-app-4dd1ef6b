import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

interface CAPIEvent {
  event_name: string;
  event_time: number;
  event_id?: string;
  event_source_url?: string;
  user_data: {
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    ct?: string[];
    st?: string[];
    zp?: string[];
    country?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
    external_id?: string[];
  };
  custom_data?: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    contents?: { id: string; quantity: number; item_price?: number }[];
    currency?: string;
    value?: number;
    num_items?: number;
    order_id?: string;
  };
  action_source: string;
}

async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      store_id,
      event_name,
      event_id,
      event_source_url,
      user_email,
      user_phone,
      user_agent,
      client_ip,
      fbc,
      fbp,
      external_id,
      first_name,
      last_name,
      city,
      state,
      zip_code,
      custom_data,
    } = await req.json();

    if (!store_id || !event_name) {
      return new Response(
        JSON.stringify({ error: "store_id and event_name required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("facebook_pixel_id, meta_access_token, currency")
      .eq("id", store_id)
      .single();

    if (storeErr || !store?.facebook_pixel_id || !store?.meta_access_token) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "meta_not_configured",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pixelId = store.facebook_pixel_id;
    const accessToken = store.meta_access_token;

    // IMPORTANT: Do NOT derive client_ip_address from the edge runtime.
    // Supabase/Deno edge IPs are datacenter IPs (US/EU) that mismatch the visitor's
    // User-Agent locale. Meta's fraud models flag this as bot/scraped traffic, which
    // contributed to ad-account bans on the platform. Only use an IP that the caller
    // explicitly passed in (e.g. cf-connecting-ip forwarded by a Cloudflare Worker
    // running on the store's own domain). Otherwise omit the field — Meta accepts
    // events without it and will rely on fbp/fbc/email/phone for matching.
    const cfIp = req.headers.get("cf-connecting-ip") || undefined;
    const realIp = client_ip || cfIp || undefined;

    const userData: CAPIEvent["user_data"] = {
      client_user_agent: user_agent || req.headers.get("user-agent") || undefined,
      fbc: fbc || undefined,
      fbp: fbp || undefined,
    };
    if (realIp) {
      userData.client_ip_address = realIp;
    }

    if (user_email) {
      userData.em = [await hashSHA256(user_email)];
    }
    if (user_phone) {
      const cleaned = user_phone.replace(/\D/g, "");
      userData.ph = [await hashSHA256(cleaned)];
    }
    if (external_id) {
      userData.external_id = [await hashSHA256(external_id)];
    }
    if (first_name) {
      userData.fn = [await hashSHA256(first_name)];
    }
    if (last_name) {
      userData.ln = [await hashSHA256(last_name)];
    }
    if (city) {
      userData.ct = [await hashSHA256(city)];
    }
    if (state) {
      userData.st = [await hashSHA256(state)];
    }
    if (zip_code) {
      userData.zp = [await hashSHA256(zip_code)];
    }
    // All ShopBanao stores are India-based
    userData.country = [await hashSHA256("in")];

    const event: CAPIEvent = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: event_id || undefined,
      event_source_url: event_source_url || undefined,
      user_data: userData,
      custom_data: custom_data || undefined,
      action_source: "website",
    };

    const metaResponse = await fetch(
      `${META_GRAPH_URL}/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [event] }),
      }
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta CAPI error:", JSON.stringify(metaResult));
      return new Response(
        JSON.stringify({ error: "Meta API error", details: metaResult }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, events_received: metaResult.events_received }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("meta-capi error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
