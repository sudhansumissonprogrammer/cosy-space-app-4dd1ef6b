import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/http.ts";

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

// v8.68.0 BAN-FIX P0-NEW-1: Per-pixel circuit breaker for HARD Meta config
// errors (codes 100=does-not-exist, 190=invalid-token, 200=permissions,
// 803=cannot-load). Edge function logs proved we were hammering Meta's Graph
// API with code-100 errors for misconfigured pixels DOZENS of times per
// minute — Meta tracks per-account 4xx rates and flags "platform abuse" →
// ad-account ban. Once a pixel returns 2 hard errors, skip it for 1 hour;
// merchant fixing the config will naturally re-enable after the TTL.
// v8.69.0: loosened from 2 fails / 60 min to 8 fails / 10 min. The old setting
// blacked out a whole pixel for an hour on just 2 transient Graph API hiccups,
// silencing every PageView/ViewContent/AddToCart CAPI mirror — exactly the EMQ
// signal a fresh ad account needs to exit learning phase. Hard config errors
// (100 / 190 / 200 / 803) still trip the breaker, just with more headroom.
const BREAKER_TTL_MS = 10 * 60_000;
const BREAKER_THRESHOLD = 8;
const BREAKER_HARD_CODES = new Set([100, 190, 200, 803]);
const breakerMap = new Map<string, { fails: number; openUntil: number }>();
function breakerOpen(pixelId: string): boolean {
  const e = breakerMap.get(pixelId);
  return !!e && e.openUntil > Date.now();
}
function breakerRecord(pixelId: string, metaErrCode: number | undefined) {
  if (!metaErrCode || !BREAKER_HARD_CODES.has(metaErrCode)) {
    breakerMap.delete(pixelId);
    return;
  }
  const e = breakerMap.get(pixelId) || { fails: 0, openUntil: 0 };
  e.fails++;
  if (e.fails >= BREAKER_THRESHOLD) e.openUntil = Date.now() + BREAKER_TTL_MS;
  breakerMap.set(pixelId, e);
}

// v8.68.0 BAN-FIX P1-NEW-1: Validate client-supplied fbc/fbp shape.
// Spec: fbp = "fb.1.<ts_ms>.<rand_int>"; fbc = "fb.1.<ts_ms>.<fbclid>".
// Malformed values from XSS / browser extensions / attackers crash EMQ
// because Meta can't match them to the user graph → "Poor" event quality →
// pixel review. Drop anything that doesn't match.
const FBP_RX = /^fb\.[12]\.\d{10,16}\.\d+$/;
const FBC_RX = /^fb\.[12]\.\d{10,16}\.[A-Za-z0-9_-]+$/;
const sanitizeFb = (v: unknown, rx: RegExp): string | undefined => {
  if (typeof v !== "string" || v.length > 256) return undefined;
  return rx.test(v) ? v : undefined;
};

type AllowedHost = { host: string; allowSubdomains?: boolean };

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function hostAllowed(host: string, allowed: AllowedHost[]): boolean {
  const clean = normalizeHost(host);
  return allowed.some((entry) => {
    const h = normalizeHost(entry.host);
    return clean === h || (!!entry.allowSubdomains && clean.endsWith(`.${h}`));
  });
}

function sanitizeEventSourceUrl(raw: unknown, allowed: AllowedHost[]): string | undefined {
  if (typeof raw !== "string" || raw.length > 2048) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.hostname !== "localhost") return undefined;
    if (!hostAllowed(u.hostname, allowed)) return undefined;
    return `${u.origin}${u.pathname}`;
  } catch {
    return undefined;
  }
}

function sanitizeCustomData(raw: unknown): CAPIEvent["custom_data"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const out: CAPIEvent["custom_data"] = {};
  if (Array.isArray(r.content_ids)) out.content_ids = r.content_ids.map(String).filter(Boolean).slice(0, 100);
  if (typeof r.content_name === "string") out.content_name = r.content_name.slice(0, 300);
  if (r.content_type === "product" || r.content_type === "product_group") out.content_type = r.content_type;
  if (Array.isArray(r.contents)) {
    out.contents = r.contents.slice(0, 100).map((x: any) => ({
      id: String(x?.id || ""),
      quantity: Math.max(1, Math.min(999, Number(x?.quantity) || 1)),
      item_price: Number.isFinite(Number(x?.item_price)) ? Math.max(0, Math.min(1_000_000, Number(x.item_price))) : undefined,
    })).filter((x) => x.id);
  }
  // v8.69.0: always normalize currency to upper-case 3-letter ISO and default
  // to INR. Old behaviour dropped "inr" / "Inr" / "" silently → Meta logged
  // "invalid currency" warning on every Purchase + InitiateCheckout, dragging
  // the pixel's quality score and starving the algo of conversion-value signal.
  {
    const cur = typeof r.currency === "string" ? r.currency.trim().toUpperCase() : "";
    out.currency = /^[A-Z]{3}$/.test(cur) ? cur : "INR";
  }
  if (Number.isFinite(Number(r.value))) out.value = Math.max(0, Math.min(1_000_000, Number(r.value)));
  if (Number.isFinite(Number(r.num_items))) out.num_items = Math.max(0, Math.min(999, Number(r.num_items)));
  return Object.keys(out).length ? out : undefined;
}

// Public browser endpoint allow-list. Purchase is intentionally excluded:
// real Purchase CAPI is fired only by payment/order edge functions via
// _shared/firePurchaseCapi.ts after the order is confirmed. Letting browsers
// post Purchase here would allow forged revenue events against any public
// store_id and can poison/ban a merchant pixel.
const ALLOWED_BROWSER_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Lead",
]);

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
      // Client-declared public IP. Cross-validated against edge headers below
      // before ever being forwarded to Meta — see safe-IP block after userData.
      declared_client_ip,
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

    if (!ALLOWED_BROWSER_EVENTS.has(String(event_name))) {
      return new Response(
        JSON.stringify({ error: "event_not_allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("facebook_pixel_id, meta_access_token, currency, custom_domain, slug, capi_disabled")
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

    // Per-store CAPI kill-switch. Merchant can flip this on to silence
    // server-side CAPI (browser Pixel keeps firing) — e.g. while appealing
    // a Meta ban — without ripping out or reconfiguring the module.
    if ((store as any).capi_disabled === true) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "capi_disabled_by_merchant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // v8.67.0 BAN-FIX P1-3: Validate Referer/Origin domain matches the store's
    // registered domain or *.shopbanao.in subdomain. CORS `*` + public store_id
    // (discoverable via window.__STORE_SLUG__) previously let any attacker
    // flood a competitor's pixel with garbage Purchase events → EMQ crash →
    // Meta ban. Browser-fired CAPI always has Origin/Referer; server-to-server
    // calls (firePurchaseCapi) use `verify-meta-capi` or the internal path, not
    // this endpoint, so we can safely require the header on this entrypoint.
    const referer = req.headers.get("referer") || req.headers.get("origin") || "";
    let refHost = "";
    try { refHost = normalizeHost(new URL(referer).hostname); } catch {}
    const allowed: AllowedHost[] = [
      ...(store.custom_domain
        ? [{ host: String(store.custom_domain), allowSubdomains: true }]
        : []),
      ...(store.slug ? [{ host: `${String(store.slug).toLowerCase()}.shopbanao.in` }] : []),
      { host: "shopbanao.in" },
    ];
    if (!refHost || !hostAllowed(refHost, allowed)) {
      return new Response(
        JSON.stringify({ error: "origin_not_allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const pixelId = store.facebook_pixel_id;
    const accessToken = store.meta_access_token;

    // v8.68.0 BAN-FIX P0-NEW-1: Skip pixels currently in the breaker.
    // Returns 200 + skipped:true so the browser pixel still fires client-side
    // (no UX impact); we just stop torching the Graph API error budget.
    if (breakerOpen(pixelId)) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "pixel_breaker_open" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // SAFE-IP POLICY (v8.70.0): previously we NEVER forwarded a client IP
    // from the browser path (routing slip risk of leaking Supabase/AWS
    // datacenter IPs → ad-account ban). Meta EMQ warned "IP missing → -14%
    // conversions". New scheme: browser fetches its own public IP via
    // api.ipify.org (declared_client_ip) and posts it here. We compare with
    // cf-connecting-ip / x-forwarded-for; only forward to Meta when they
    // match AND the IP is public IPv4/IPv6. Any mismatch → drop silently
    // (same zero-leak guarantee as before, just without the free money).
    const headerIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";
    const declaredIp = typeof declared_client_ip === "string" ? declared_client_ip.trim() : "";
    const safeClientIp =
      declaredIp && headerIp && declaredIp === headerIp && !isPrivateIpV(declaredIp)
        ? declaredIp
        : undefined;

    const userData: CAPIEvent["user_data"] = {
      client_user_agent: user_agent || req.headers.get("user-agent") || undefined,
      client_ip_address: safeClientIp,
      // v8.68.0 BAN-FIX P1-NEW-1: validate fb cookies before sending.
      fbc: sanitizeFb(fbc, FBC_RX),
      fbp: sanitizeFb(fbp, FBP_RX),
    };


    if (user_email) {
      userData.em = [await hashSHA256(normEmail(user_email))];
    }
    if (user_phone) {
      const cleaned = user_phone.replace(/\D/g, "");
      // v8.61.0 BAN-FIX P1-3: Indian phones must include the 91 country code
      // before hashing. Meta stores all phones in E.164-without-plus form, so
      // sha256("9876543210") never matches sha256("919876543210"). Result was
      // ~zero phone match rate across every Indian storefront → tanked EMQ.
      const e164 = cleaned.length === 10 ? `91${cleaned}` : cleaned;
      if (e164) userData.ph = [await hashSHA256(e164)];
    }
    if (external_id) {
      // external_id is an opaque visitor/customer ID (UUID), NOT an email.
      // Meta spec: SHA-256 of the trimmed raw value. Using normEmail() here lowercases
      // UUIDs and silently mismatches firePurchaseCapi.ts → tanks Event Match Quality.
      userData.external_id = [await hashSHA256(String(external_id).trim())];
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
      event_source_url: sanitizeEventSourceUrl(event_source_url, allowed),
      user_data: userData,
      custom_data: sanitizeCustomData(custom_data),
      action_source: "website",
    };

    const sendOnce = () => fetchWithTimeout(
      `${META_GRAPH_URL}/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ data: [event] }),
        timeoutMs: 8000,
      }
    );
    let metaResponse = await sendOnce();
    if (metaResponse.status >= 500 && metaResponse.status < 600) {
      await new Promise((r) => setTimeout(r, 500));
      metaResponse = await sendOnce();
    }

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      // v8.68.0 BAN-FIX P0-NEW-1: record hard-config failures into per-pixel
      // breaker so we stop spamming Graph API with the same broken pixel.
      const code = Number(metaResult?.error?.code);
      breakerRecord(pixelId, Number.isFinite(code) ? code : undefined);
      console.error("Meta CAPI error:", JSON.stringify(metaResult));
      return new Response(
        JSON.stringify({ error: "Meta API error", details: metaResult }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Success → clear any prior fail count for this pixel.
    breakerRecord(pixelId, undefined);

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
