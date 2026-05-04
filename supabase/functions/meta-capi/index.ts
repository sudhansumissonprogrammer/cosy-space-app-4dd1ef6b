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

// Normalization helpers per Meta CAPI spec.
// https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
// Mismatched normalization = the hash on our side ≠ Meta's hash = no match = low EMQ.
const normEmail = (v: string) => v.trim().toLowerCase();
const normName = (v: string) => v.trim().toLowerCase().replace(/[^a-zà-ÿ\u0080-\uffff]/g, "");
const normCityState = (v: string) => v.trim().toLowerCase().replace(/[^a-z]/g, "");
const normZip = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "");
const normCountry = (v: string) => v.trim().toLowerCase().slice(0, 2);

async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Simple in-memory rate limiter — 30 events per IP per minute.
// Prevents bad actors from spamming garbage events at a store's pixel,
// which would drop the EMQ score and trigger Meta scrutiny.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const rlMap = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rlMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit by client IP (cf-connecting-ip when behind Worker, else x-forwarded-for).
  const rlIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  if (rateLimited(rlIp)) {
    return new Response(
      JSON.stringify({ error: "rate_limited" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
      // client_ip intentionally ignored — see zero-ban policy below
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

    // ZERO-BAN POLICY: Never attach client_ip_address from the browser-event path.
    // Routing can change (Cloudflare bypass, direct *.supabase.co call, internal retry,
    // preview slip-through) and any of those would leak a Supabase/AWS datacenter IP
    // tagged as the buyer — the exact mismatch signal that triggered prior ad-account
    // bans. Browser events already carry fbp/fbc/email/phone/user_agent, so dropping
    // IP costs ~1-3% EMQ for permanent zero datacenter-IP-leak risk on every path.
    // Server-side Purchase events still send the verified order.buyer_ip captured at
    // checkout (see _shared/firePurchaseCapi.ts) — that path is unaffected.
    const userData: CAPIEvent["user_data"] = {
      client_user_agent: user_agent || req.headers.get("user-agent") || undefined,
      fbc: fbc || undefined,
      fbp: fbp || undefined,
    };

    if (user_email) {
      userData.em = [await hashSHA256(normEmail(user_email))];
    }
    if (user_phone) {
      const cleaned = user_phone.replace(/\D/g, "");
      if (cleaned) userData.ph = [await hashSHA256(cleaned)];
    }
    if (external_id) {
      userData.external_id = [await hashSHA256(normEmail(external_id))];
    }
    if (first_name) {
      const v = normName(first_name);
      if (v) userData.fn = [await hashSHA256(v)];
    }
    if (last_name) {
      const v = normName(last_name);
      if (v) userData.ln = [await hashSHA256(v)];
    }
    if (city) {
      const v = normCityState(city);
      if (v) userData.ct = [await hashSHA256(v)];
    }
    if (state) {
      const v = normCityState(state);
      if (v) userData.st = [await hashSHA256(v)];
    }
    if (zip_code) {
      const v = normZip(zip_code);
      if (v) userData.zp = [await hashSHA256(v)];
    }
    // Only set country when we have a real address signal (city/state/zip).
    if (city || state || zip_code) {
      userData.country = [await hashSHA256(normCountry("in"))];
    }

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
